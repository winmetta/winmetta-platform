#!/usr/bin/env bash
# Nightly: dump the Umami database to S3 (dumps/ expires after 30 days, see the bucket
# lifecycle rule). Records success (for the daily health report) only after the dump has been listed back.
set -euo pipefail
# shellcheck source=/dev/null
source /etc/analytics/instance.env
stamp=$(date -u +%Y-%m-%d)
file="/data/tmp/umami-${stamp}.dump"
trap 'rm -f "$file"' EXIT

docker exec analytics-postgres pg_dump -U umami -d umami --format=custom >"$file"
docker exec -i analytics-postgres pg_restore --list <"$file" >/dev/null
aws s3 cp "$file" "s3://${BUCKET}/dumps/umami-${stamp}.dump" --region "$AWS_REGION" --sse AES256 --only-show-errors
install -d /var/lib/analytics/status
date +%s >/var/lib/analytics/status/backup.ok
