#!/usr/bin/env bash
# Restore a dump into the running database. Usage: restore-dump.sh <dump file name under dumps/, e.g. umami-2026-10-30.dump>
# Restore TWO_FACTOR_ENCRYPTION_KEY into Parameter Store FIRST (it is not in the dump); this
# script then copies it into the Umami environment file before Umami starts, because that file
# was written at first boot and would otherwise still hold a newly generated key. Afterwards
# check that an existing user's 2FA code is accepted (docs/runbook.md).
set -euo pipefail
# shellcheck source=/dev/null
source /etc/analytics/instance.env
dump=${1:?usage: restore-dump.sh <dump file name under dumps/>}
file="/data/tmp/restore.dump"
trap 'rm -f "$file"' EXIT

refresh_two_factor_key() {
    local twofa
    twofa=$(aws ssm get-parameter --region "$AWS_REGION" --name "$PARAM_PREFIX/two-factor-key" \
        --with-decryption --query Parameter.Value --output text)
    [[ $twofa =~ ^[0-9a-f]{64}$ ]] || {
        echo "The two-factor key in Parameter Store is not 64 hex characters; restore the sealed key first." >&2
        exit 1
    }
    sed -i "s|^TWO_FACTOR_ENCRYPTION_KEY=.*|TWO_FACTOR_ENCRYPTION_KEY=${twofa}|" /etc/analytics/umami.env
}

aws s3 cp "s3://${BUCKET}/dumps/${dump}" "$file" --region "$AWS_REGION" --only-show-errors
refresh_two_factor_key
systemctl stop analytics-umami
docker exec -i analytics-postgres pg_restore -U umami -d umami --clean --if-exists --no-owner <"$file"
# The restored database already holds the real administrator accounts: never let the
# installer's first-boot step replace the admin password again.
touch /data/.admin-bootstrapped
systemctl start analytics-umami
echo "Restored ${dump}."
