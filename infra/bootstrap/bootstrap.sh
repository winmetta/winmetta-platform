#!/usr/bin/env bash
# One-time AWS bootstrap for the Pulumi backend (implementation-plan.md, Phase 2 step 2).
# Creates what must exist before `pulumi login s3://...` and is not managed by Pulumi:
#   1. a private, versioned S3 bucket for Pulumi state
#   2. a KMS key (alias/winmetta-pulumi) for Pulumi's secrets provider
#   3. the GitHub Actions OIDC identity provider
# Safe to re-run: each step checks whether the resource already exists.
#
# Dry run by default (prints every command, changes nothing). To apply:
#   aws sso login --profile winmetta-admin
#   AWS_PROFILE=winmetta-admin ./infra/bootstrap/bootstrap.sh --apply
#
# The account ID is never written to a file or printed; record the resource names it
# prints (not the account ID) in the runbook. Works with bash 3.2 and AWS CLI v2.
set -euo pipefail

REGION="us-east-1"
BUCKET="${BUCKET:-winmetta-pulumi-state}" # bucket names are global; set BUCKET= if taken
KMS_ALIAS="alias/winmetta-pulumi"
OIDC_URL="token.actions.githubusercontent.com"

apply=false
[ "${1:-}" = "--apply" ] && apply=true

# AWS_REGION wins over AWS_DEFAULT_REGION, so set both. An empty pager keeps the
# CLI from blocking the script on a "less" prompt.
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
[ -n "${AWS_PROFILE:-}" ] || {
    echo "Set AWS_PROFILE (winmetta-admin) first." >&2
    exit 1
}
[ "$AWS_PROFILE" = "winmetta-admin" ] || echo "note: expected AWS_PROFILE=winmetta-admin, got $AWS_PROFILE" >&2

# Run a changing command, or only print it in a dry run.
run() {
    if $apply; then
        echo "+ $*"
        "$@"
    else
        echo "[dry run] $*"
    fi
}

# Read-only calls always run, so the dry run shows what already exists.
identity="$(aws sts get-caller-identity --query '[Arn,Account]' --output text)" || {
    echo "Not signed in. Run: aws sso login --profile $AWS_PROFILE" >&2
    exit 1
}
caller="${identity%%$'\t'*}"
account_id="${identity##*$'\t'}"
echo "Signed in as: ${caller//$account_id/ACCOUNT}"
echo "Region: $REGION   State bucket: $BUCKET   KMS alias: $KMS_ALIAS"
$apply || echo "Dry run: nothing will change. Add --apply to create the resources."
echo

# 1. State bucket ---------------------------------------------------------------
head_err=""
if head_err="$(aws s3api head-bucket --bucket "$BUCKET" 2>&1)"; then
    echo "ok       bucket $BUCKET exists (settings below are re-applied, which is harmless)"
else
    # A 403 means the name exists but belongs to someone else (bucket names are global).
    case "$head_err" in
    *403* | *Forbidden*) echo "error: bucket name $BUCKET is taken by another account; rerun with BUCKET=<another name>" >&2 && exit 1 ;;
    esac
    # us-east-1 takes no LocationConstraint. The bucket is private from the start.
    run aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --object-ownership BucketOwnerEnforced
fi
run aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
run aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
run aws s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
# Refuse plain-HTTP access. This replaces any existing bucket policy, which is fine
# for a bucket this script created and owns.
run aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"DenyInsecureTransport\",\"Effect\":\"Deny\",\"Principal\":\"*\",\"Action\":\"s3:*\",\"Resource\":[\"arn:aws:s3:::$BUCKET\",\"arn:aws:s3:::$BUCKET/*\"],\"Condition\":{\"Bool\":{\"aws:SecureTransport\":\"false\"}}}]}"
# Keep old state versions for 90 days (rollback), then expire them, and clean up
# abandoned uploads.
run aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration '{"Rules":[{"ID":"expire-old-state-versions","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":90},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'

# 2. KMS key for Pulumi secrets -------------------------------------------------
if aws kms describe-key --key-id "$KMS_ALIAS" >/dev/null 2>&1; then
    echo "ok       KMS key $KMS_ALIAS exists"
else
    if $apply; then
        key_id="$(aws kms create-key --description "Win Metta Pulumi secrets provider" --query KeyMetadata.KeyId --output text)"
        echo "+ aws kms create-key ... -> $key_id"
        # If a later step fails, a rerun would create a second key (the alias is what it
        # looks for), so say which key is left over.
        trap 'echo "error: key $key_id was created but is not finished. Fix the error, then run: aws kms enable-key-rotation --key-id $key_id; aws kms create-alias --alias-name $KMS_ALIAS --target-key-id $key_id (or schedule it for deletion) before rerunning." >&2' ERR
        run aws kms enable-key-rotation --key-id "$key_id"
        run aws kms create-alias --alias-name "$KMS_ALIAS" --target-key-id "$key_id"
        trap - ERR
    else
        echo "[dry run] aws kms create-key --description \"Win Metta Pulumi secrets provider\""
        echo "[dry run] aws kms enable-key-rotation --key-id <new key id>"
        echo "[dry run] aws kms create-alias --alias-name $KMS_ALIAS --target-key-id <new key id>"
    fi
fi

# 3. GitHub Actions OIDC identity provider ---------------------------------------
provider_arn="arn:aws:iam::${account_id}:oidc-provider/${OIDC_URL}"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$provider_arn" >/dev/null 2>&1; then
    echo "ok       OIDC provider $OIDC_URL exists"
else
    # AWS validates GitHub's certificate against its trusted CAs, so no thumbprint is needed.
    run aws iam create-open-id-connect-provider --url "https://$OIDC_URL" --client-id-list sts.amazonaws.com
fi

echo
echo "Record in the runbook (names only, never the account ID):"
echo "  state bucket: $BUCKET ($REGION)   KMS alias: $KMS_ALIAS   OIDC provider: $OIDC_URL"
echo "Then: pulumi login s3://$BUCKET   and use  --secrets-provider \"awskms://$KMS_ALIAS?region=$REGION\""
