#!/usr/bin/env bash
# Nightly: dump the Umami database to S3 (dumps/ expires after 21 days, see the bucket
# lifecycle rule). Records success (for the daily health report) only after the dump has been listed back.
set -euo pipefail
# shellcheck source=/dev/null
source /etc/analytics/instance.env
state=/var/lib/analytics/status
stamp=$(date -u +%Y-%m-%d)
file="/data/tmp/umami-${stamp}.dump"
trap 'rm -f "$file"' EXIT

# Never dump unscrubbed data: if the last successful retention and scrub run is older than
# three hours (for example the 01:30 job failed, or this is a manual run), run it first; if it
# fails, the script stops here (set -e) and no dump is uploaded.
maintenance_epoch=$(cat "$state/maintenance.ok" 2>/dev/null || echo 0)
if [ $(($(date +%s) - maintenance_epoch)) -gt 10800 ]; then
    /opt/analytics/bin/maintenance.sh
fi

docker exec analytics-postgres pg_dump -U umami -d umami --format=custom >"$file"
docker exec -i analytics-postgres pg_restore --list <"$file" >/dev/null
aws s3 cp "$file" "s3://${BUCKET}/dumps/umami-${stamp}.dump" --region "$AWS_REGION" --sse AES256 --only-show-errors
install -d "$state"
date +%s >"$state/backup.ok"
