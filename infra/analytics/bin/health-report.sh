#!/usr/bin/env bash
# Daily health report for the analytics server, run by analytics-report.timer (05:00 UTC,
# after the 02:00 backup and 03:00 retention jobs). It checks the machine (load, memory,
# swap, disk, I/O, network, containers, time sync), the site (HTTPS and certificate), the
# updates that need a reboot, and our own promises (backups ran, no event older than the
# retention limit, no scrubbed field left). It emails ONE digest through the SNS topic when
# something needs attention, and a short "all OK" only on Mondays, so there is little noise.
# Why a script and not CloudWatch alarms: docs/analytics.md §9 item 11. Thresholds are
# below; change them here. Tested only by reading it so far (stage 2 acceptance).
set -uo pipefail
# shellcheck source=/dev/null
source /etc/analytics/instance.env # AWS_REGION STATS_DOMAIN TOPIC_ARN ...

STATE=/var/lib/analytics/status
install -d "$STATE"
findings=()
notes=()
warn() { findings+=("$*"); }
note() { notes+=("$*"); }

# --- Machine ---------------------------------------------------------------------------
cores=$(nproc)
read -r load1 load5 load15 _ </proc/loadavg
note "Load average: $load1 $load5 $load15 on $cores core(s)"
if awk -v l="$load15" -v c="$cores" 'BEGIN { exit !(l > c) }'; then
    warn "15-minute load average $load15 is above the $cores core(s)"
fi

# Pressure-stall information (kernel): the share of the last 5 minutes some task was stalled.
for res in cpu memory io; do
    file=/proc/pressure/$res
    [ -r "$file" ] || continue
    some=$(awk '/^some/ { for (i = 1; i <= NF; i++) if ($i ~ /^avg300=/) { sub("avg300=", "", $i); print $i } }' "$file")
    note "Pressure ($res, 5-minute): ${some:-?}%"
    if awk -v p="${some:-0}" 'BEGIN { exit !(p > 10) }'; then
        warn "$res pressure is ${some}% over the last 5 minutes (tasks are waiting for $res)"
    fi
done

mem_avail=$(awk '/^MemAvailable/ { a = $2 } /^MemTotal/ { t = $2 } END { printf "%.0f", a * 100 / t }' /proc/meminfo)
swap_total=$(awk '/^SwapTotal/ { print $2 }' /proc/meminfo)
swap_free=$(awk '/^SwapFree/ { print $2 }' /proc/meminfo)
note "Memory available: ${mem_avail}%"
[ "$mem_avail" -lt 15 ] && warn "Only ${mem_avail}% of memory is available"
if [ "${swap_total:-0}" -gt 0 ]; then
    swap_used=$(((swap_total - swap_free) * 100 / swap_total))
    note "Swap used: ${swap_used}%"
    [ "$swap_used" -gt 50 ] && warn "Swap is ${swap_used}% used"
else
    note "Swap: none configured"
fi
oom=$(journalctl -k --since "-24 hours" --no-pager 2>/dev/null | grep -c "Out of memory" || true)
[ "${oom:-0}" -gt 0 ] && warn "The kernel killed a process for lack of memory $oom time(s) in the last 24 hours"

for mount in / /data; do
    mountpoint -q "$mount" || continue
    used=$(df --output=pcent "$mount" | tail -1 | tr -dc '0-9')
    inodes=$(df --output=ipcent "$mount" | tail -1 | tr -dc '0-9')
    note "Disk $mount: ${used}% used, inodes ${inodes:-?}%"
    [ "$used" -gt 80 ] && warn "Disk $mount is ${used}% full"
    [ "${inodes:-0}" -gt 80 ] && warn "Disk $mount has used ${inodes}% of its inodes"
done

# Network and I/O totals for yesterday from sysstat's history, when it is installed.
if command -v sar >/dev/null 2>&1; then
    yesterday=/var/log/sa/sa$(date -d yesterday +%d)
    if [ -r "$yesterday" ]; then
        traffic=$(sar -n DEV -f "$yesterday" 2>/dev/null | awk '$2 == "eth0" || $2 ~ /^ens/ || $2 ~ /^enX/ { rx += $5; tx += $6; n++ } END { if (n) printf "average %.0f kB/s in, %.0f kB/s out", rx / n, tx / n }')
        [ -n "$traffic" ] && note "Network yesterday: $traffic"
        await=$(sar -d -p -f "$yesterday" 2>/dev/null | awk '$2 ~ /^nvme/ || $2 ~ /^xvd/ { w += $(NF-4); n++ } END { if (n) printf "%.1f", w / n }')
        [ -n "$await" ] && note "Disk wait yesterday: average ${await} ms"
    else
        note "Network and I/O history: none yet for yesterday"
    fi
else
    note "sysstat is not installed; no network or I/O history"
fi

if [ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" != "yes" ]; then
    warn "The clock is not synchronized (certificates and the daily salt depend on it)"
fi

failed=$(systemctl --failed --no-legend --plain 2>/dev/null | awk '{ print $1 }' | paste -sd' ' -)
[ -n "$failed" ] && warn "Failed systemd units: $failed"

# --- Containers and services -----------------------------------------------------------
for svc in analytics-postgres analytics-umami analytics-caddy; do
    if ! docker ps --filter "name=^${svc}\$" --filter status=running --format '{{.Names}}' | grep -q .; then
        warn "$svc is not running"
        continue
    fi
    restarts=$(systemctl show -p NRestarts --value "$svc" 2>/dev/null || echo 0)
    previous=$(cat "$STATE/$svc.restarts" 2>/dev/null || echo 0)
    echo "$restarts" >"$STATE/$svc.restarts"
    [ "$restarts" -gt "$previous" ] && warn "$svc restarted $((restarts - previous)) time(s) since the last report"
done

# --- Site: HTTPS and certificate -------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${STATS_DOMAIN}/api/heartbeat" || true)
note "https://${STATS_DOMAIN}/api/heartbeat answered ${code:-no answer}"
[ "$code" = "200" ] || warn "https://${STATS_DOMAIN}/api/heartbeat answered ${code:-nothing} instead of 200"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${STATS_DOMAIN}/script.js" || true)
[ "$code" = "200" ] || warn "The tracker script (script.js) answered ${code:-nothing} instead of 200"

end=$(echo | openssl s_client -connect "${STATS_DOMAIN}:443" -servername "$STATS_DOMAIN" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
    days=$((($(date -d "$end" +%s) - $(date +%s)) / 86400))
    note "HTTPS certificate: ${days} day(s) left"
    [ "$days" -lt 21 ] && warn "The HTTPS certificate expires in ${days} day(s); Caddy should have renewed it by now"
else
    warn "Could not read the HTTPS certificate of ${STATS_DOMAIN}"
fi

# --- Updates ---------------------------------------------------------------------------
# dnf check-update exits 100 when updates exist, 0 when none, and anything else when it
# could not check (repository down, DNS, broken metadata): that must not look like "no updates".
sec=$(dnf --releasever=latest check-update --security --quiet 2>/dev/null)
dnf_status=$?
case $dnf_status in
0) ;;
100)
    count=$(echo "$sec" | grep -c '^[A-Za-z0-9]' || true)
    warn "$count security update(s) are waiting in the latest release (analytics-os-update applies them weekly; check why not)"
    ;;
*) warn "Could not check for security updates (dnf check-update exited $dnf_status: a repository, DNS or metadata problem)" ;;
esac
if command -v needs-restarting >/dev/null 2>&1; then
    needs-restarting -r >/dev/null 2>&1 || warn "A reboot is needed to finish updates: sudo reboot (see runbook, routine)"
else
    latest=$(rpm -q kernel --last 2>/dev/null | head -1 | awk '{ print $1 }' | sed 's/^kernel-//')
    [ -n "$latest" ] && [ "$latest" != "$(uname -r)" ] && warn "A newer kernel ($latest) is installed than the one running ($(uname -r)); reboot"
fi
note "Uptime: $(uptime -p)"

# --- Our own promises ------------------------------------------------------------------
age_hours() { [ -r "$1" ] && echo $((($(date +%s) - $(cat "$1")) / 3600)) || echo ""; }
for job in backup maintenance; do
    hours=$(age_hours "$STATE/$job.ok")
    if [ -z "$hours" ]; then
        warn "The nightly $job job has never finished"
    elif [ "$hours" -gt 26 ]; then
        warn "The nightly $job job last finished ${hours} hours ago"
    else
        note "Nightly $job job finished ${hours} hours ago"
    fi
done

# The weekly OS update must have run in the last 9 days.
hours=$(age_hours "$STATE/os-update.ok")
if [ -z "$hours" ]; then
    warn "The weekly operating system update has never finished"
elif [ "$hours" -gt 216 ]; then
    warn "The weekly operating system update last finished $((hours / 24)) days ago"
else
    note "Operating system update finished $((hours / 24)) day(s) ago"
fi

# Dumps are deleted by an S3 lifecycle rule after 21 days, which S3 carries out with some delay.
# Check that none is older than the deadline (docs/analytics.md section 4, retention).
oldest_dump=$(aws s3 ls "s3://${BUCKET}/dumps/" --region "$AWS_REGION" 2>/dev/null | awk '{ print $1 }' | sort | head -1)
if [ -n "$oldest_dump" ]; then
    dump_days=$((($(date +%s) - $(date -d "$oldest_dump" +%s)) / 86400))
    note "Oldest database dump: ${dump_days} day(s)"
    [ "$dump_days" -gt 23 ] && warn "A database dump is ${dump_days} days old: dumps must be gone after 21 days (retention). Check the bucket lifecycle rule and delete it with an admin profile"
fi

# Snapshots are deleted by age (14 days) by the data lifecycle policy. Check that one is made
# every day and that none outlived the limit, so retention does not depend on the policy working.
snapshots=$(aws ec2 describe-snapshots --region "$AWS_REGION" --owner-ids self \
    --filters "Name=volume-id,Values=${DATA_VOLUME_ID}" --query 'Snapshots[].StartTime' --output text 2>/dev/null | tr '\t' '\n' | sort)
if [ -n "$snapshots" ]; then
    newest_days=$((($(date +%s) - $(date -d "$(tail -1 <<<"$snapshots")" +%s)) / 86400))
    oldest_days=$((($(date +%s) - $(date -d "$(head -1 <<<"$snapshots")" +%s)) / 86400))
    note "Snapshots of the data volume: newest ${newest_days} day(s), oldest ${oldest_days} day(s)"
    [ "$newest_days" -gt 1 ] && warn "No snapshot of the data volume for ${newest_days} days: check the data lifecycle policy"
    [ "$oldest_days" -gt 16 ] && warn "A snapshot of the data volume is ${oldest_days} days old (limit 14): it must be deleted for the retention promise (admin profile)"
else
    warn "Could not list snapshots of the data volume (or there are none yet)"
fi

sql() { docker exec -i analytics-postgres psql -U umami -d umami -At -c "$1" 2>/dev/null; }
oldest=$(sql "SELECT COALESCE(floor(extract(epoch FROM now() - min(created_at)) / 86400)::int, 0) FROM website_event")
if [ -n "$oldest" ]; then
    note "Oldest stored event: ${oldest} day(s) (limit 366)"
    [ "$oldest" -gt 366 ] && warn "An event is ${oldest} days old: the 12-month retention job is not working"
else
    warn "Could not query the database"
fi
# Only rows older than the last maintenance run can be expected to be scrubbed already; rows
# created between that run and this report are scrubbed by the next one.
maintenance_epoch=$(cat "$STATE/maintenance.ok" 2>/dev/null || true)
if [[ $maintenance_epoch =~ ^[0-9]+$ ]]; then
    cutoff="to_timestamp($maintenance_epoch) - interval '5 minutes'"
    unscrubbed=$(sql "SELECT count(*) FROM session WHERE created_at < $cutoff AND (screen IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL OR distinct_id IS NOT NULL)")
    [ "${unscrubbed:-0}" -gt 0 ] && warn "$unscrubbed session(s) still hold screen, region, city or distinct id: the scrub job is not working"
    queries=$(sql "SELECT count(*) FROM website_event WHERE created_at < $cutoff AND (url_query IS NOT NULL OR referrer_query IS NOT NULL)")
    [ "${queries:-0}" -gt 0 ] && warn "$queries event(s) still hold a URL or referrer query string: check the tracker and the scrub job"
else
    note "Scrub check skipped: no maintenance run has been recorded yet"
fi
events=$(sql "SELECT count(*) FROM website_event WHERE created_at > now() - interval '24 hours'")
last_events=$(cat "$STATE/events.last" 2>/dev/null || echo 0)
echo "${events:-0}" >"$STATE/events.last"
note "Events in the last 24 hours: ${events:-?}"
if [ "${events:-0}" -eq 0 ] && [ "$last_events" -gt 0 ]; then
    warn "No events arrived in the last 24 hours (the day before there were $last_events): the tracker or the site may be broken"
fi

# --- Report ----------------------------------------------------------------------------
{
    echo "Analytics server report for ${STATS_DOMAIN}, $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo
    if [ "${#findings[@]}" -gt 0 ]; then
        echo "NEEDS ATTENTION:"
        printf ' - %s\n' "${findings[@]}"
        echo
    else
        echo "Nothing needs attention."
        echo
    fi
    echo "Details:"
    printf ' - %s\n' "${notes[@]}"
    echo
    echo "What to do: docs/runbook.md, analytics section (connect with Session Manager)."
} >/tmp/analytics-report.txt
cat /tmp/analytics-report.txt # also lands in the journal: journalctl -u analytics-report

if [ "${#findings[@]}" -gt 0 ]; then
    subject="ATTENTION (${#findings[@]}): ${STATS_DOMAIN} daily report"
elif [ "$(date -u +%u)" = "1" ]; then
    subject="OK: ${STATS_DOMAIN} weekly report"
else
    exit 0
fi
aws sns publish --region "$AWS_REGION" --topic-arn "$TOPIC_ARN" --subject "$subject" \
    --message "file:///tmp/analytics-report.txt" >/dev/null
