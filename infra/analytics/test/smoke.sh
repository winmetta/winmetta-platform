#!/usr/bin/env bash
# Smoke test for the analytics server's moving parts, on a laptop with Docker (Colima is
# fine). It starts throwaway PostgreSQL and Umami containers from the versions pinned in
# ../versions.env, lets Umami create its real schema, then checks:
#   1. the first-boot admin password replacement (install.sh) really lets Umami log in
#   2. sql/maintenance.sql: retention, foreign keys, scrub, and that it can run twice
#   3. sql/reset-2fa.sql: clears one user's 2FA and nobody else's
#   4. the Caddyfile validates and its login rate limit works in front of Umami
# Usage: infra/analytics/test/smoke.sh      (about 5 minutes the first time: it builds Caddy)
# It touches nothing but its own containers, network and volume, and removes them at the end.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(dirname "$HERE")
PREFIX=analytics-smoke
NETWORK=${PREFIX}-net
UMAMI_PORT=${UMAMI_PORT:-13000}
CADDY_PORT=${CADDY_PORT:-18080}
failures=0

log() { printf '\n== %s\n' "$*"; }
pass() { printf '  ok   %s\n' "$*"; }
fail() {
    printf '  FAIL %s\n' "$*" >&2
    failures=$((failures + 1))
}

require_docker() {
    docker info >/dev/null 2>&1 || {
        echo "Docker is not running (try: colima start)" >&2
        exit 2
    }
}

cleanup() {
    docker rm -f "${PREFIX}-umami" "${PREFIX}-pg" "${PREFIX}-caddy" >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
    docker volume rm "${PREFIX}-data" >/dev/null 2>&1 || true
}

# Runs a command and records the result under a label.
check() {
    local label=$1
    shift
    if "$@"; then pass "$label"; else fail "$label"; fi
}

# Runs a SQL file through psql (extra arguments are passed to psql).
run_sql_file() {
    local file=$1
    shift
    psql_db "$@" <"$file" >/dev/null
}

login_is() { [[ $(login_status admin "$2") == "$1" ]]; }

psql_db() { docker exec -i "${PREFIX}-pg" psql -U umami -d umami -At -v ON_ERROR_STOP=1 "$@"; }

# Asserts that a SQL query returns exactly the expected text.
expect_sql() {
    local label=$1 expected=$2 query=$3 actual
    actual=$(psql_db -c "$query")
    if [[ $actual == "$expected" ]]; then pass "$label"; else fail "$label (expected '$expected', got '$actual')"; fi
}

start_database() {
    docker network create "$NETWORK" >/dev/null
    docker run -d --name "${PREFIX}-pg" --network "$NETWORK" -e POSTGRES_USER=umami -e POSTGRES_DB=umami \
        -e POSTGRES_PASSWORD=smoketest -v "${PREFIX}-data:/var/lib/postgresql" "$POSTGRES_IMAGE" >/dev/null
    local _
    for _ in $(seq 1 40); do
        docker exec "${PREFIX}-pg" pg_isready -U umami -d umami >/dev/null 2>&1 && return 0
        sleep 2
    done
    echo "PostgreSQL did not start" >&2
    exit 1
}

start_umami() {
    docker run -d --name "${PREFIX}-umami" --network "$NETWORK" --network-alias analytics-umami \
        -p "${UMAMI_PORT}:3000" \
        -e "DATABASE_URL=postgresql://umami:smoketest@${PREFIX}-pg:5432/umami" -e APP_SECRET=smoketest \
        -e "TWO_FACTOR_ENCRYPTION_KEY=$(openssl rand -hex 32)" -e SALT_ROTATION=day \
        -e DISABLE_TELEMETRY=1 -e PRIVATE_MODE=1 "$UMAMI_IMAGE" >/dev/null
    local _
    for _ in $(seq 1 60); do
        curl -fs "http://localhost:${UMAMI_PORT}/api/heartbeat" >/dev/null 2>&1 && return 0
        sleep 3
    done
    echo "Umami did not start" >&2
    exit 1
}

build_caddy() {
    CADDY_IMAGE="analytics-caddy-smoke:${CADDY_VERSION}"
    docker build -q --build-arg "CADDY_VERSION=${CADDY_VERSION}" --build-arg "RATELIMIT_REF=${CADDY_RATELIMIT_REF}" \
        -t "$CADDY_IMAGE" "$ROOT/caddy" >/dev/null
}

login_status() {
    curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:${UMAMI_PORT}/api/auth/login" \
        -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}"
}

# install.sh replaces the default admin password with a bcrypt hash made by `caddy hash-password`.
test_admin_password() {
    log "1. first-boot admin password replacement"
    check "default admin/umami works on a fresh install (so it must be replaced)" login_is 200 umami
    local pw hash
    pw=$(openssl rand -hex 24)
    hash=$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$pw")
    docker exec -i "${PREFIX}-pg" psql -U umami -d umami -v ON_ERROR_STOP=1 -v hash="$hash" >/dev/null <<'SQL'
UPDATE "user" SET password = :'hash' WHERE username = 'admin';
SQL
    check "the new random password logs in" login_is 200 "$pw"
    check "the default password no longer works" login_is 401 umami
}

json_field() { python3 -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1]))' "$1"; }

# install.sh requires 2FA for everyone before Caddy starts; Umami must then report it as required.
test_global_2fa() {
    log "1b. global two-factor requirement"
    local pw token status
    pw=$(openssl rand -hex 24)
    docker exec -i "${PREFIX}-pg" psql -U umami -d umami -v ON_ERROR_STOP=1 -v hash="$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$pw")" >/dev/null <<'SQL'
UPDATE "user" SET password = :'hash' WHERE username = 'admin';
SQL
    token=$(curl -s -X POST "http://localhost:${UMAMI_PORT}/api/auth/login" -H 'Content-Type: application/json' \
        -d "{\"username\":\"admin\",\"password\":\"$pw\"}" | json_field token)
    status=$(curl -s -H "Authorization: Bearer $token" "http://localhost:${UMAMI_PORT}/api/2fa/status")
    check "before the setting, 2FA is not required" test "$(json_field isRequired <<<"$status")" = False
    check "enable-global-2fa.sql runs" run_sql_file "$ROOT/sql/enable-global-2fa.sql"
    check "it can run twice" run_sql_file "$ROOT/sql/enable-global-2fa.sql"
    status=$(curl -s -H "Authorization: Bearer $token" "http://localhost:${UMAMI_PORT}/api/2fa/status")
    check "Umami now requires 2FA for everyone (reason: global)" test "$(json_field isRequired <<<"$status")/$(json_field requiredReason <<<"$status")" = True/global
}

test_maintenance() {
    log "2. maintenance.sql"
    psql_db <"$HERE/seed.sql" >/dev/null
    expect_sql "seeded events" "5" "SELECT count(*) FROM website_event"
    check "first run succeeded" run_sql_file "$ROOT/sql/maintenance.sql"
    expect_sql "events older than 12 months are gone" "2" "SELECT count(*) FROM website_event"
    expect_sql "old sessions without recent events are gone, an old session with a recent event stays" \
        "00000000-0000-0000-0000-0000000000b2,00000000-0000-0000-0000-0000000000b3" \
        "SELECT string_agg(session_id::text, ',' ORDER BY session_id) FROM session"
    expect_sql "event_data of old events is gone, even when newer than its parent" "1" "SELECT count(*) FROM event_data"
    expect_sql "session_data of deleted sessions is gone" "1" "SELECT count(*) FROM session_data"
    expect_sql "screen, region, city and distinct id are scrubbed" "0" \
        "SELECT count(*) FROM session WHERE screen IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL OR distinct_id IS NOT NULL"
    expect_sql "query strings, page title and utm fields are scrubbed" "0" \
        "SELECT count(*) FROM website_event WHERE url_query IS NOT NULL OR referrer_query IS NOT NULL OR page_title IS NOT NULL OR utm_source IS NOT NULL"
    expect_sql "paths and event names are kept" "/en/classes/|class_zoom_join_click" \
        "SELECT url_path || '|' || event_name FROM website_event WHERE event_name IS NOT NULL"
    check "second run succeeded (idempotent)" run_sql_file "$ROOT/sql/maintenance.sql"
}

test_reset_2fa() {
    log "3. reset-2fa.sql"
    psql_db >/dev/null <<'SQL'
INSERT INTO "user" (user_id, username, password, role, created_at) VALUES
 ('00000000-0000-0000-0000-0000000000e1', 'alice', 'x', 'user', now()),
 ('00000000-0000-0000-0000-0000000000e2', 'bob', 'x', 'user', now());
INSERT INTO two_factor_auth (id, user_id, secret, is_enabled, updated_at) VALUES
 ('t1', '00000000-0000-0000-0000-0000000000e1', 's', true, now()), ('t2', '00000000-0000-0000-0000-0000000000e2', 's', true, now());
INSERT INTO two_factor_backup_code (id, user_id, code_hash) VALUES
 ('b1', '00000000-0000-0000-0000-0000000000e1', 'h'), ('b2', '00000000-0000-0000-0000-0000000000e2', 'h');
INSERT INTO two_factor_otp_used (id, user_id, otp, expires_at) VALUES
 ('o1', '00000000-0000-0000-0000-0000000000e1', '123456', now()), ('o2', '00000000-0000-0000-0000-0000000000e2', '123456', now());
INSERT INTO two_factor_rate_limit (id, user_id, attempts, updated_at) VALUES
 ('r1', '00000000-0000-0000-0000-0000000000e1', 5, now()), ('r2', '00000000-0000-0000-0000-0000000000e2', 5, now());
SQL
    check "reset ran for alice" run_sql_file "$ROOT/sql/reset-2fa.sql" -v target_user=alice
    expect_sql "alice has no 2FA rows left" "0|0|0|0" "SELECT (SELECT count(*) FROM two_factor_auth WHERE user_id = '00000000-0000-0000-0000-0000000000e1') || '|' || (SELECT count(*) FROM two_factor_backup_code WHERE user_id = '00000000-0000-0000-0000-0000000000e1') || '|' || (SELECT count(*) FROM two_factor_otp_used WHERE user_id = '00000000-0000-0000-0000-0000000000e1') || '|' || (SELECT count(*) FROM two_factor_rate_limit WHERE user_id = '00000000-0000-0000-0000-0000000000e1')"
    expect_sql "bob is untouched" "1|1|1|1" "SELECT (SELECT count(*) FROM two_factor_auth WHERE user_id = '00000000-0000-0000-0000-0000000000e2') || '|' || (SELECT count(*) FROM two_factor_backup_code WHERE user_id = '00000000-0000-0000-0000-0000000000e2') || '|' || (SELECT count(*) FROM two_factor_otp_used WHERE user_id = '00000000-0000-0000-0000-0000000000e2') || '|' || (SELECT count(*) FROM two_factor_rate_limit WHERE user_id = '00000000-0000-0000-0000-0000000000e2')"
}

restore_dump() { docker exec -i "${PREFIX}-pg" pg_restore -U umami -d umami --single-transaction --exit-on-error --clean --if-exists --no-owner; }

# The flags of restore-dump.sh: a damaged dump must leave the database as it was, a good one
# must bring the dumped state back.
test_restore() {
    log "3b. restore (the pg_restore flags of restore-dump.sh)"
    local good=/tmp/${PREFIX}-good.dump bad=/tmp/${PREFIX}-bad.dump
    docker exec "${PREFIX}-pg" pg_dump -U umami -d umami --format=custom >"$good"
    head -c "$(($(wc -c <"$good") / 2))" "$good" >"$bad"
    psql_db -c "UPDATE website SET name = 'changed' WHERE website_id = '00000000-0000-0000-0000-0000000000a1'" >/dev/null
    if restore_dump <"$bad" >/dev/null 2>&1; then fail "a damaged dump was accepted"; else pass "a damaged dump is rejected"; fi
    expect_sql "the database is unchanged after the failed restore" "changed" \
        "SELECT name FROM website WHERE website_id = '00000000-0000-0000-0000-0000000000a1'"
    check "a good dump restores" restore_dump <"$good"
    expect_sql "the dumped state is back" "test" \
        "SELECT name FROM website WHERE website_id = '00000000-0000-0000-0000-0000000000a1'"
    rm -f "$good" "$bad"
}

caddy_validates() {
    docker run --rm -e STATS_DOMAIN=stats.example.test -v "$ROOT/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
        "$CADDY_IMAGE" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1
}

proxy_answers() {
    [[ $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${CADDY_PORT}/api/heartbeat") == 200 ]]
}

test_caddy() {
    log "4. Caddyfile"
    check "caddy validate" caddy_validates
    # Same Caddyfile, plain HTTP on a local port, in front of the Umami container.
    docker run -d --name "${PREFIX}-caddy" --network "$NETWORK" -p "${CADDY_PORT}:8080" \
        -e STATS_DOMAIN="http://:8080" -v "$ROOT/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" "$CADDY_IMAGE" >/dev/null
    sleep 4
    check "Caddy proxies /api/heartbeat to Umami" proxy_answers
    local codes
    codes=$(for _ in $(seq 1 12); do
        curl -s -o /dev/null -w '%{http_code} ' -X POST "http://localhost:${CADDY_PORT}/api/auth/login" \
            -H 'Content-Type: application/json' -d '{"username":"nobody","password":"wrong"}'
    done)
    if [[ $codes == *429* ]]; then pass "login attempts are rate limited (${codes})"; else fail "no 429 in 12 login attempts: ${codes}"; fi
}

main() {
    require_docker
    # shellcheck source=/dev/null
    source "$ROOT/versions.env"
    trap cleanup EXIT
    cleanup
    log "starting PostgreSQL and Umami (${POSTGRES_IMAGE}, ${UMAMI_IMAGE}), building Caddy"
    start_database
    start_umami
    build_caddy
    test_admin_password
    test_global_2fa
    test_maintenance
    test_reset_2fa
    test_restore
    test_caddy
    log "done: ${failures} failure(s)"
    [[ $failures -eq 0 ]]
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
