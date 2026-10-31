#!/usr/bin/env bash
# Break-glass: clear one dashboard user's 2FA at the database level, for when every
# administrator has lost their authenticator and backup codes. Take a dump first
# (bin/backup.sh) and see the runbook. Usage: reset-2fa.sh <username>
set -euo pipefail
user=${1:?usage: reset-2fa.sh <username>}

# psql does not expand :'variables' in a -c string, so the query goes in on stdin.
found=$(
    docker exec -i analytics-postgres psql -U umami -d umami -At -v ON_ERROR_STOP=1 -v target_user="$user" <<'SQL'
SELECT count(*) FROM "user" WHERE username = :'target_user' AND deleted_at IS NULL;
SQL
)
[ "$found" = "1" ] || {
    echo "No such user: $user" >&2
    exit 1
}
docker exec -i analytics-postgres psql -U umami -d umami -v target_user="$user" </opt/analytics/sql/reset-2fa.sql
echo "2FA cleared for $user. They enrol again at the next sign-in. Note the date in the private repo."
