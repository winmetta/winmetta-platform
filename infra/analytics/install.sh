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

log() { echo "[analytics-install] $*"; }

install_packages() {
    dnf install -y docker dnf-automatic sysstat dnf-utils
    mkdir -p /etc/docker
    cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
    systemctl enable --now docker
    # Security updates apply by themselves; reboot for kernel updates in the monthly maintenance.
    sed -i 's/^apply_updates.*/apply_updates = yes/; s/^upgrade_type.*/upgrade_type = security/' /etc/dnf/automatic.conf
    systemctl enable --now dnf-automatic-install.timer
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
    if ! docker image inspect "analytics-caddy:${CADDY_VERSION}" >/dev/null 2>&1; then
        # Free the memory for the build; the services start again below.
        systemctl stop analytics-caddy analytics-umami 2>/dev/null || true
        docker build --build-arg "CADDY_VERSION=${CADDY_VERSION}" --build-arg "RATELIMIT_REF=${CADDY_RATELIMIT_REF}" \
            -t "analytics-caddy:${CADDY_VERSION}" /opt/analytics/caddy
    fi
}

install_units() {
    cp /opt/analytics/systemd/* /etc/systemd/system/
    systemctl daemon-reload
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
    hash=$(docker run --rm "analytics-caddy:${CADDY_VERSION}" caddy hash-password --plaintext "$pw")
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

# Caddy is what puts the dashboard on the internet, so it starts last.
start_public_services() {
    systemctl enable --now analytics-caddy analytics-backup.timer analytics-maintenance.timer \
        analytics-report.timer
}

install_packages
set_hostname
ensure_swap
mount_data_volume
sync_config
write_env_files
prepare_images
install_units
systemctl enable --now analytics-postgres analytics-umami
secure_admin_account
start_public_services
setup_shell
log "done"
