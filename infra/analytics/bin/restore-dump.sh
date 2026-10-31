#!/usr/bin/env bash
# Restore a dump into the running database. Usage: restore-dump.sh <s3 key under dumps/, e.g. umami-2026-10-30.dump>
# Restore TWO_FACTOR_ENCRYPTION_KEY into Parameter Store FIRST (it is not in the dump),
# then run this, then check that an existing user's 2FA code is accepted (docs/runbook.md).
set -euo pipefail
# shellcheck source=/dev/null
source /etc/analytics/instance.env
key=${1:?usage: restore-dump.sh <dump file name under dumps/>}
file="/data/tmp/restore.dump"
trap 'rm -f "$file"' EXIT
aws s3 cp "s3://${BUCKET}/dumps/${key}" "$file" --region "$AWS_REGION" --only-show-errors
systemctl stop analytics-umami
docker exec -i analytics-postgres pg_restore -U umami -d umami --clean --if-exists --no-owner <"$file"
# The restored database already holds the real administrator accounts: never let the
# installer's first-boot step replace the admin password again.
touch /data/.admin-bootstrapped
systemctl start analytics-umami
echo "Restored ${key}."
