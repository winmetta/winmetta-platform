#!/usr/bin/env bash
# Installs or updates the analytics server: Umami + PostgreSQL + Caddy on Docker, with
# timers for backup, retention and the daily health report. Runs as root from the first-boot user data
# (infra/pulumi/analytics.ts) and again by hand through Session Manager after a config
# change; every step is safe to repeat. Design: docs/analytics.md section 5.
# This script has not run on a real instance yet (stage 2 acceptance).
set -euo pipefail

# shellcheck source=/dev/null
source /etc/analytics/instance.env # AWS_REGION BUCKET STATS_DOMAIN INSTANCE_NAME DATA_VOLUME_ID PARAM_PREFIX
export AWS_DEFAULT_REGION=$AWS_REGION
# Fingerprint of this installer as it is running, to notice if the sync below replaces it.
SELF_HASH=$(sha256sum <"${BASH_SOURCE[0]}" | cut -d' ' -f1)

log() { echo "[analytics-install] $*"; }

install_packages() {
    dnf install -y docker sysstat dnf-utils
    mkdir -p /etc/docker
    cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
    systemctl enable --now docker
    # Updates: an AL2023 instance is locked to the repository version of its AMI, so dnf-automatic
    # alone would only ever install updates from that old snapshot. analytics-os-update.timer
    # (weekly) upgrades to the latest repository version instead; a kernel update needs a reboot,
    # which the daily report asks for.
    # Keeps network and I/O history for the daily report; not essential, so do not stop the install.
    systemctl enable --now sysstat || log "sysstat not enabled; traffic history will be missing"
    mkdir -p /var/lib/analytics/status
}

# Use the instance's Name tag (winmetta-analytics) as the host name, so shell prompts, logs
# and Session Manager sessions say which machine this is. cloud-init would reset it on every
# boot unless told not to; the /etc/hosts line keeps sudo from complaining.
set_hostname() {
    hostnamectl set-hostname "$INSTANCE_NAME"
    printf 'preserve_hostname: true\n' >/etc/cloud/cloud.cfg.d/99-preserve-hostname.cfg
    grep -q "[[:space:]]${INSTANCE_NAME}\$" /etc/hosts || echo "127.0.0.1 ${INSTANCE_NAME}" >>/etc/hosts
}

# A 2 GB machine running Umami and PostgreSQL has little room for the Caddy image build
# (xcaddy compiles Go) on an upgrade; swap keeps the kernel from killing a process.
ensure_swap() {
    [ -e /swapfile ] && return
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
}

mount_data_volume() {
    if mountpoint -q /data; then return; fi
    local dev="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${DATA_VOLUME_ID//-/}"
    for _ in $(seq 1 60); do
        [ -e "$dev" ] && break
        sleep 5
    done
    [ -e "$dev" ] || {
        log "data volume $DATA_VOLUME_ID is not attached"
        exit 1
    }
    # Only format a blank volume; an existing filesystem (a reattached volume) is kept.
    blkid "$dev" >/dev/null 2>&1 || mkfs.xfs -L analytics-data "$dev"
    mkdir -p /data
    grep -q 'LABEL=analytics-data' /etc/fstab || echo 'LABEL=analytics-data /data xfs defaults,nofail 0 2' >>/etc/fstab
    mount /data
    mkdir -p /data/postgres /data/caddy /data/tmp
}

sync_config() {
    aws s3 sync "s3://${BUCKET}/config/" /opt/analytics/ --delete --only-show-errors
    chmod +x /opt/analytics/install.sh /opt/analytics/bin/*.sh
}

# This script was loaded before the sync could replace it, so when the sync brought a newer
# installer, hand over to it (once) instead of finishing with the old functions.
reexec_if_installer_changed() {
    local now
    now=$(sha256sum </opt/analytics/install.sh | cut -d' ' -f1)
    if [ "$now" != "$SELF_HASH" ] && [ -z "${ANALYTICS_INSTALL_REEXEC:-}" ]; then
        log "the installer changed; continuing with the new one"
        ANALYTICS_INSTALL_REEXEC=1 exec bash /opt/analytics/install.sh "$@"
    fi
}

# Secrets are created once on the instance and kept in Parameter Store, never in git, in
# Pulumi state or in user data. The key for 2FA is NOT in the database dump: after the
# first boot an administrator copies a sealed copy to the password manager (runbook).
ensure_secret() {
    aws ssm get-parameter --name "$PARAM_PREFIX/$1" >/dev/null 2>&1 && return
    aws ssm put-parameter --name "$PARAM_PREFIX/$1" --type SecureString --no-overwrite \
        --value "$(openssl rand -hex 32)" >/dev/null
    log "created secret $1"
}
secret() { aws ssm get-parameter --name "$PARAM_PREFIX/$1" --with-decryption --query Parameter.Value --output text; }

write_env_files() {
    local db app twofa
    ensure_secret db-password
    ensure_secret app-secret
    ensure_secret two-factor-key
    db=$(secret db-password)
    app=$(secret app-secret)
    twofa=$(secret two-factor-key)
    (
        umask 077
        cat >/etc/analytics/postgres.env <<EOF2
POSTGRES_USER=umami
POSTGRES_DB=umami
POSTGRES_PASSWORD=${db}
EOF2
        cat >/etc/analytics/umami.env <<EOF2
DATABASE_URL=postgresql://umami:${db}@analytics-postgres:5432/umami?connection_limit=5
APP_SECRET=${app}
TWO_FACTOR_ENCRYPTION_KEY=${twofa}
SALT_ROTATION=day
DISABLE_TELEMETRY=1
DISABLE_UPDATES=1
PRIVATE_MODE=1
TRUSTED_PROXIES=private
EOF2
    )
}

prepare_images() {
    # shellcheck source=/dev/null
    source /opt/analytics/versions.env
    docker network inspect analytics >/dev/null 2>&1 || docker network create analytics
    docker pull "$POSTGRES_IMAGE"
    docker pull "$UMAMI_IMAGE"
    # The tag carries a fingerprint of the build inputs (Dockerfile and rate-limit module
    # revision), so changing either makes a new tag, a rebuild and, below, a restart.
    CADDY_IMAGE="analytics-caddy:${CADDY_VERSION}-$({
        cat /opt/analytics/caddy/Dockerfile
        printf '%s' "$CADDY_RATELIMIT_REF"
    } | sha256sum | cut -c1-12)"
    # Build while the current services keep running (the 2 GB swap file makes room); if the
    # build fails the installer stops here with nothing stopped and the unit's image file
    # (/etc/analytics/caddy-image) still pointing at the image that is running.
    if ! docker image inspect "$CADDY_IMAGE" >/dev/null 2>&1; then
        docker build --build-arg "CADDY_VERSION=${CADDY_VERSION}" --build-arg "RATELIMIT_REF=${CADDY_RATELIMIT_REF}" \
            -t "$CADDY_IMAGE" /opt/analytics/caddy
    fi
    printf 'CADDY_IMAGE=%s\n' "$CADDY_IMAGE" >/etc/analytics/caddy-image
}

install_units() {
    cp /opt/analytics/systemd/* /etc/systemd/system/
    systemctl daemon-reload
}

# A running container keeps using the image and settings it started with, and
# `systemctl enable --now` does not restart a unit that is already active. So after an
# update the services are restarted when (a) a pulled image differs from the running one, or
# (b) the runtime configuration changed: the Caddyfile, a unit, versions.env or an env file
# (compared by fingerprint, so the secrets themselves are never stored). Nothing restarts on
# a first boot or when nothing changed.
config_fingerprint() {
    {
        cat /opt/analytics/caddy/Caddyfile /opt/analytics/versions.env /etc/analytics/*.env
        cat /opt/analytics/systemd/*.service /opt/analytics/systemd/*.timer
    } 2>/dev/null | sha256sum | cut -d' ' -f1
}

restart_changed_services() {
    # shellcheck source=/dev/null
    source /opt/analytics/versions.env
    # shellcheck source=/dev/null
    source /etc/analytics/caddy-image
    local pair unit image running wanted restart_all=0 now stored
    local stamp=/var/lib/analytics/status/config.sha256
    now=$(config_fingerprint)
    stored=$(cat "$stamp" 2>/dev/null || true)
    if [ -n "$stored" ] && [ "$stored" != "$now" ]; then
        log "runtime configuration changed; restarting the services"
        restart_all=1
    fi
    for pair in "analytics-postgres:${POSTGRES_IMAGE}" "analytics-umami:${UMAMI_IMAGE}" "analytics-caddy:${CADDY_IMAGE}"; do
        unit=${pair%%:*}
        image=${pair#*:}
        if [ "$restart_all" = 1 ]; then
            systemctl restart "$unit"
            continue
        fi
        running=$(docker inspect -f '{{.Image}}' "$unit" 2>/dev/null || true)
        wanted=$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null || true)
        if [ -n "$running" ] && [ -n "$wanted" ] && [ "$running" != "$wanted" ]; then
            log "$unit runs an older image; restarting it"
            systemctl restart "$unit"
        fi
    done
    printf '%s\n' "$now" >"$stamp"
}

# Umami installs a well-known administrator login (admin / umami). Nothing listens on the
# public ports until Caddy starts, so the password is replaced here first, and the new one
# is left in Parameter Store for the maintainer to read once, change and delete
# (docs/runbook.md, analytics section). The marker keeps a later run, or a restore, from
# resetting a password the maintainer has already changed.
secure_admin_account() {
    [ -e /data/.admin-bootstrapped ] && return
    local i pw hash
    # shellcheck source=/dev/null
    source /opt/analytics/versions.env
    for i in $(seq 1 60); do
        if [ "$(docker exec analytics-postgres psql -U umami -d umami -At -c "SELECT count(*) FROM \"user\" WHERE username = 'admin'" 2>/dev/null)" = "1" ]; then
            break
        fi
        [ "$i" = 60 ] && {
            log "the admin account never appeared; not starting Caddy"
            exit 1
        }
        sleep 5
    done
    pw=$(openssl rand -hex 24)
    # shellcheck source=/dev/null
    source /etc/analytics/caddy-image
    hash=$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$pw")
    docker exec -i analytics-postgres psql -U umami -d umami -v ON_ERROR_STOP=1 -v hash="$hash" <<'SQL'
UPDATE "user" SET password = :'hash' WHERE username = 'admin';
SQL
    aws ssm put-parameter --name "$PARAM_PREFIX/admin-bootstrap-password" --type SecureString \
        --overwrite --value "$pw" >/dev/null
    touch /data/.admin-bootstrapped
    log "default admin password replaced; read it once from $PARAM_PREFIX/admin-bootstrap-password"
}

# Troubleshooting tools, vim, screen and the a- aliases (bin/setup-shell.sh). Not needed by
# the service, so a failure here is logged and does not stop the install.
setup_shell() {
    if ! /opt/analytics/bin/setup-shell.sh; then
        log "shell tools setup failed (the service is unaffected); re-run: sudo /opt/analytics/bin/setup-shell.sh"
    fi
}

# Require two-factor sign-in for every account before the dashboard is public. The key in
# umami.env only makes enrolment possible; this is the installation-wide requirement (the
# setting behind Admin > Security), set directly in the database and checked.
require_global_2fa() {
    docker exec -i analytics-postgres psql -U umami -d umami -v ON_ERROR_STOP=1 </opt/analytics/sql/enable-global-2fa.sql >/dev/null
    local value
    value=$(docker exec analytics-postgres psql -U umami -d umami -At -c "SELECT value FROM app_setting WHERE key = 'twoFactorRequiredGlobal'")
    [ "$value" = "true" ] || {
        log "could not enable the global 2FA requirement; not starting Caddy"
        exit 1
    }
}

# Caddy is what puts the dashboard on the internet, so it starts last.
start_public_services() {
    systemctl enable --now analytics-caddy analytics-backup.timer analytics-maintenance.timer \
        analytics-os-update.timer analytics-report.timer
}

install_packages
set_hostname
ensure_swap
mount_data_volume
sync_config
reexec_if_installer_changed "$@"
write_env_files
prepare_images
install_units
systemctl enable --now analytics-postgres analytics-umami
restart_changed_services
secure_admin_account
require_global_2fa
start_public_services
setup_shell
log "done"
