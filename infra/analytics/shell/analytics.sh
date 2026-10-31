# shellcheck shell=bash
# Aliases and helpers for working on the analytics server. Installed as
# /etc/profile.d/analytics.sh by bin/setup-shell.sh, so every bash shell has them.
# Discover them: type `alias` (all start with a-), or `a-help` for a cheat sheet.
# Session Manager starts plain `sh`: type `bash` first. Edit this file in the repo
# (infra/analytics/shell/analytics.sh), not on the server: the config sync overwrites it.

# Editors (plain `sh` Session Manager sessions get these too). `vi` is a link to the full
# vim (installed by bin/setup-shell.sh), and sudo keeps the variables.
export EDITOR=vi VISUAL=vi SUDO_EDITOR=vi

[ -n "${BASH_VERSION:-}" ] || return 0
case $- in *i*) ;; *) return 0 ;; esac

# Non-secret settings written at first boot (AWS_REGION BUCKET STATS_DOMAIN INSTANCE_NAME ...).
if [ -r /etc/analytics/instance.env ]; then
    set -a
    # shellcheck source=/dev/null
    . /etc/analytics/instance.env
    set +a
fi

export PAGER=less LESS='-FRX'
export HISTSIZE=10000 HISTTIMEFORMAT='%F %T '

# --- Where things are -------------------------------------------------------------------
#   /opt/analytics                  scripts, units, SQL, Caddyfile (synced from S3 config/)
#   /etc/analytics                  instance.env (not secret), postgres.env and umami.env (secret)
#   /etc/systemd/system/analytics-* the systemd units
#   /data                           the data volume: /data/postgres, /data/caddy (certificates)
#   /var/lib/analytics/status       "last success" stamps the daily report reads
#   /var/log/analytics-install.log  the first-boot install log
alias a-files='printf "%s\n" "/opt/analytics (scripts, units, SQL, Caddyfile)" "/opt/analytics/bin  /opt/analytics/sql  /opt/analytics/caddy  /opt/analytics/systemd" "/etc/analytics (instance.env; postgres.env and umami.env are secret)" "/etc/systemd/system/analytics-*" "/data/postgres  /data/caddy (certificates)" "/var/lib/analytics/status" "/var/log/analytics-install.log" "/tmp/analytics-report.txt (last daily report)"'
alias a-cd='cd /opt/analytics && ls'
alias a-ls='ls -la /opt/analytics /opt/analytics/bin /opt/analytics/sql /opt/analytics/systemd'
alias a-cat-health='less /opt/analytics/bin/health-report.sh'
alias a-cat-backup='less /opt/analytics/bin/backup.sh'
alias a-cat-maintenance='less /opt/analytics/bin/maintenance.sh'
alias a-cat-install='less /opt/analytics/install.sh'
alias a-cat-restore='less /opt/analytics/bin/restore-dump.sh'
alias a-cat-reset2fa='less /opt/analytics/bin/reset-2fa.sh'
alias a-cat-sql='less /opt/analytics/sql/maintenance.sql'
alias a-cat-caddyfile='less /opt/analytics/caddy/Caddyfile'
alias a-cat-versions='cat /opt/analytics/versions.env'
alias a-cat-units='cat /etc/systemd/system/analytics-*.service /etc/systemd/system/analytics-*.timer | less'
alias a-cat-env='cat /etc/analytics/instance.env'
alias a-umami-env='sudo grep -vE "SECRET|KEY|PASSWORD|DATABASE_URL" /etc/analytics/umami.env'

# --- systemd: what is running and why not -----------------------------------------------
alias a-status='systemctl status analytics-postgres analytics-umami analytics-caddy --no-pager'
alias a-services='systemctl list-units "analytics-*" --all --no-pager'
alias a-timers='systemctl list-timers "analytics-*" --all --no-pager'
alias a-failed='systemctl --failed --no-pager'
alias a-logs-umami='sudo journalctl -u analytics-umami -n 100 -f'
alias a-logs-postgres='sudo journalctl -u analytics-postgres -n 100 -f'
alias a-logs-caddy='sudo journalctl -u analytics-caddy -n 100 -f'
alias a-logs-backup='sudo journalctl -u analytics-backup -n 50 --no-pager'
alias a-logs-maintenance='sudo journalctl -u analytics-maintenance -n 50 --no-pager'
alias a-logs-report='sudo journalctl -u analytics-report -n 100 --no-pager'
alias a-logs-install='less +G /var/log/analytics-install.log'
alias a-restart-umami='sudo systemctl restart analytics-umami && a-status'
alias a-restart-caddy='sudo systemctl restart analytics-caddy && a-status'
alias a-restart-postgres='sudo systemctl restart analytics-postgres && a-status'
alias a-ps='sudo docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"'
alias a-stats='sudo docker stats --no-stream'
alias a-images='sudo docker images'
alias a-umami-version='sudo docker inspect analytics-umami --format "{{.Config.Image}} started {{.State.StartedAt}}"'

# --- Jobs: run one now, see the last result (the report emails only if something is wrong) ---
alias a-run-backup='sudo systemctl start analytics-backup.service && a-logs-backup'
alias a-run-maintenance='sudo systemctl start analytics-maintenance.service && a-logs-maintenance'
alias a-run-report='sudo systemctl start analytics-report.service && a-logs-report'
alias a-report-last='cat /tmp/analytics-report.txt'
alias a-stamps='sudo ls -l --time-style=long-iso /var/lib/analytics/status'

# --- AWS: this machine's role can read s3://$BUCKET/config/ and its own secrets' names ---
alias a-whoami='aws sts get-caller-identity --output table'
alias a-s3-config='aws s3 ls "s3://$BUCKET/config/" --recursive --human-readable'
alias a-s3-diff='aws s3 sync "s3://$BUCKET/config/" /opt/analytics/ --delete --dryrun'
alias a-s3-sync='sudo aws s3 sync "s3://$BUCKET/config/" /opt/analytics/ --delete && sudo chmod +x /opt/analytics/install.sh /opt/analytics/bin/*.sh'
alias a-s3-dumps='aws s3 ls "s3://$BUCKET/dumps/" --human-readable || echo "This role can write dumps but not list them (by design). List them from your laptop with an admin profile."'
alias a-ssm-names='aws ssm describe-parameters --parameter-filters "Key=Path,Values=$PARAM_PREFIX" --query "Parameters[].[Name,LastModifiedDate]" --output table'
alias a-imds='TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60") && curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/dynamic/instance-identity/document'

# --- PostgreSQL (runs in the analytics-postgres container; the host also has psql) ------
a-pg() { sudo docker exec -i analytics-postgres psql -U umami -d umami -P pager=off -c "$1"; }
alias a-psql='sudo docker exec -it analytics-postgres psql -U umami -d umami'
alias a-pg-ready='sudo docker exec analytics-postgres pg_isready -U umami -d umami'
alias a-pg-tables='a-pg "\\dt+"'
alias a-pg-sizes='a-pg "SELECT relname AS table, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC"'
alias a-pg-dbsize='a-pg "SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size"'
alias a-pg-counts='a-pg "SELECT '"'"'website_event'"'"' AS tbl, count(*) FROM website_event UNION ALL SELECT '"'"'session'"'"', count(*) FROM session UNION ALL SELECT '"'"'event_data'"'"', count(*) FROM event_data"'
alias a-pg-oldest='a-pg "SELECT min(created_at) AS oldest, max(created_at) AS newest, count(*) AS events FROM website_event"'
alias a-pg-today='a-pg "SELECT coalesce(event_name, '"'"'(page view)'"'"') AS event, count(*) FROM website_event WHERE created_at > date_trunc('"'"'day'"'"', now()) GROUP BY 1 ORDER BY 2 DESC"'
alias a-pg-users='a-pg "SELECT u.username, u.role, u.created_at, coalesce(t.is_enabled, false) AS two_factor FROM \"user\" u LEFT JOIN two_factor_auth t ON t.user_id = u.user_id WHERE u.deleted_at IS NULL ORDER BY 1"'
alias a-pg-conns='a-pg "SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1"'
alias a-pg-unscrubbed='a-pg "SELECT count(*) AS sessions_with_unwanted_fields FROM session WHERE screen IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL OR distinct_id IS NOT NULL"'
alias a-pg-client='psql --version'

# --- Umami and Caddy: is the site answering? ---------------------------------------------
alias a-health='curl -si --max-time 15 "https://$STATS_DOMAIN/api/heartbeat"'
alias a-script='curl -sI --max-time 15 "https://$STATS_DOMAIN/script.js"'
alias a-headers='curl -sI --max-time 15 "https://$STATS_DOMAIN/"'
alias a-umami-inside='sudo docker exec analytics-umami wget -qO- http://localhost:3000/api/heartbeat; echo'
alias a-tls='echo | openssl s_client -connect "$STATS_DOMAIN:443" -servername "$STATS_DOMAIN" 2>/dev/null | openssl x509 -noout -subject -issuer -dates'
alias a-dns='dig +short "$STATS_DOMAIN"; echo "this machine: $(curl -s https://checkip.amazonaws.com)"'
alias a-caddy-validate='sudo docker exec analytics-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile'
alias a-caddy-certs='sudo ls -R /data/caddy/caddy/certificates 2>/dev/null | head -20'

# --- The machine: CPU, memory, disk, network ---------------------------------------------
alias a-cpu='top -bn1 | head -15'
alias a-mem='free -h; echo; ps aux --sort=-%mem | head -8'
alias a-load='uptime; head -n1 /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io'
alias a-disk='df -hT -x tmpfs -x devtmpfs; echo; lsblk'
alias a-du='sudo du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -15'
alias a-io='iostat -xz 1 3'
alias a-vm='vmstat 1 5'
alias a-net='sudo ss -tulpn'
alias a-conns='ss -s'
alias a-bandwidth='sar -n DEV 1 3'
alias a-time='timedatectl; chronyc tracking 2>/dev/null | head -5'
alias a-updates='dnf check-update --security; needs-restarting -r'
alias a-top='htop'

# --- Scripts: lint and format (ShellCheck, shfmt), see also vim with ALE -----------------
alias a-lint='shellcheck -x /opt/analytics/install.sh /opt/analytics/bin/*.sh'
alias a-fmt='shfmt -d -i 4 /opt/analytics/install.sh /opt/analytics/bin/*.sh'

# --- screen: sessions that survive a dropped connection ----------------------------------
alias a-screen='screen -DR analytics'
alias a-screens='screen -ls'

a-aliases() { alias | grep '^alias a-' | sort; }

a-help() {
    cat <<'EOF'
ANALYTICS SERVER CHEAT SHEET            (type `alias` for every shortcut, all start with a-)

Where things are      a-files  a-cd  a-ls  a-cat-health|backup|maintenance|install|sql|caddyfile|units|env|versions
Services (systemd)    a-status  a-services  a-timers  a-failed  a-logs-umami|postgres|caddy|backup|report|install
                      a-restart-umami|caddy|postgres  a-ps  a-stats  a-umami-version
Jobs                  a-run-backup  a-run-maintenance  a-run-report (emails if something is wrong)
                      a-report-last  a-stamps
AWS                   a-whoami  a-s3-config  a-s3-diff  a-s3-sync  a-s3-dumps  a-ssm-names  a-imds
PostgreSQL            a-psql (interactive)  a-pg "SELECT ..."  a-pg-tables  a-pg-sizes  a-pg-counts  a-pg-oldest
                      a-pg-today  a-pg-users  a-pg-conns  a-pg-unscrubbed  a-pg-ready  a-pg-dbsize
Umami and Caddy       a-health  a-script  a-headers  a-umami-inside  a-tls  a-dns  a-caddy-validate  a-caddy-certs
Machine               a-cpu  a-mem  a-load  a-disk  a-du  a-io  a-vm  a-net  a-conns  a-bandwidth  a-time  a-updates  a-top
Scripts               a-lint  a-fmt   (vim lints shell scripts with ShellCheck; \f formats with shfmt; ]e [e next/previous)
screen                a-screen  a-screens

Everyday Linux commands (examples)
  CPU / load      top    htop    uptime    vmstat 1 5    mpstat -P ALL 1 3    ps aux --sort=-%cpu | head
  Memory          free -h    ps aux --sort=-%mem | head    cat /proc/meminfo | head
  Disk            df -hT    lsblk    sudo du -xh --max-depth=1 /data | sort -h    iostat -xz 1 3    sudo iotop -o
  Network         ss -tulpn    ss -s    ip -br addr    ip route    ping -c3 host    traceroute host    mtr -rw host
                  dig +short name    curl -sI https://host/    sudo tcpdump -ni any port 443 -c 20    nc -vz host 443
  Processes       pgrep -a name    sudo lsof -i :443    sudo strace -p PID -f    kill PID
  Logs            sudo journalctl -u UNIT -f    journalctl -p err -b    journalctl --since "1 hour ago"    dmesg -T | tail
  Files           ls -la    find /opt -name '*.sh'    grep -rn text /opt/analytics    less +G file    tail -f file
  Docker          sudo docker ps    sudo docker logs -f NAME    sudo docker exec -it NAME sh    sudo docker stats
  Time            date -u    timedatectl    chronyc tracking

screen (a session that survives a dropped connection; keys start with Ctrl-a)
  screen -S name    start a named session         Ctrl-a d    detach (it keeps running)
  screen -ls        list sessions                 screen -r name    reattach (screen -DR name: attach or create)
  Ctrl-a c  new window   Ctrl-a n / p  next / previous   Ctrl-a "  list windows   Ctrl-a A  rename window
  Ctrl-a [  scroll back (arrows, PageUp; q leaves)       Ctrl-a ?  help      exit  closes a window
  screen -X -S name quit    end a session from outside

vim: ]e / [e next / previous ShellCheck problem   \f format with shfmt   :ALEDetail explain   F2 paste mode
EOF
}

printf 'Analytics server %s: type a-help for a cheat sheet, or "alias" to list the a- shortcuts.\n' "${INSTANCE_NAME:-}"
