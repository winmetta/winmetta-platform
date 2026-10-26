# Runbook: app.winmetta.org (Phase 2 hosting)

How to operate the production site: deploy, roll back, change the infrastructure, set it up from nothing, and fix the usual problems. It is written so that a maintainer who did not build it can follow it. Design and reasoning are in [tech-architecture.md](tech-architecture.md) §6 to §8; the plan and its status are in [implementation-plan.md](implementation-plan.md) §4.

**Never write the AWS account ID in the repository, an issue, a pull request or a log.** This repository is public. Names (bucket, role, key alias) are fine; the account ID is not. The deploy and preview workflows get it from the repository secret `AWS_ACCOUNT_ID`, which GitHub masks in logs. Variables are never masked.

## 1. The system at a glance

| What                | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Site                | `https://app.winmetta.org`, a static Astro build (`apps/web`)                                                              |
| Hosting             | Private S3 bucket `winmetta-app-production-site` behind CloudFront (origin access control), all in `us-east-1`             |
| DNS                 | Route 53 zone `app.winmetta.org`, delegated from DreamHost with four NS records for `app`. `winmetta.org` itself stays on DreamHost |
| Certificate         | ACM, DNS-validated in Route 53, renews by itself while its validation record stays                                         |
| Infrastructure code | Pulumi (TypeScript) in `infra/pulumi/`, one stack `production`                                                             |
| Pulumi state        | Private versioned S3 bucket `winmetta-pulumi-state`, secrets provider KMS key `alias/winmetta-pulumi`                      |
| Deploys             | `.github/workflows/deploy-web.yml`, approved by a reviewer on the GitHub `production` environment                          |
| Previews            | `.github/workflows/pulumi-preview.yml` runs `pulumi preview` on pull requests that touch `infra/pulumi/`                   |
| Library PDFs        | The existing `dhamma-library` bucket and bunny.net pull zone. They are outside Pulumi and unchanged                        |
| Maintainer          | ALO (GitHub `ninegene`)                                                                                                    |
| Indexing            | Controlled only by the build variable `PUBLIC_ALLOW_INDEXING` (see §8)                                                     |

Choices recorded in plan step 0: login profile `winmetta-admin`, region `us-east-1`, a monthly AWS budget alert, CloudFront pay-as-you-go pricing (not a flat-rate plan, so the site never stops serving at a plan limit), and resource names as above.

## 2. Access

- **AWS** uses IAM Identity Center (SSO). There are two profiles: `winmetta-ro` (read only, everyday) and `winmetta-admin` (`AdministratorAccess`, for the bootstrap and `pulumi up` only). Set them up as in the [developer guide](developer-guide.md). Sign in with `aws sso login --profile winmetta-admin`, and check with `aws sts get-caller-identity --profile winmetta-admin`. Confirm before any command that changes AWS, and read a `pulumi preview` before every `pulumi up`.
- **Pulumi** uses the SSO session. If it says `Failed to refresh cached SSO credentials` while the CLI works, export temporary credentials into the shell:
  `eval "$(aws configure export-credentials --profile winmetta-admin --format env)"`
- **GitHub:** the `production` environment has a required reviewer (`ninegene`), allows only the `main` branch, and holds the variables `SITE_URL`, `PUBLIC_ALLOW_INDEXING`, `SITE_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID`. The repository secret `AWS_ACCOUNT_ID` holds the account ID. No long-lived AWS keys are stored anywhere.

## 3. Deploy a change

Editing content or code and publishing it is the normal path.

1. Make the change on a branch and open a pull request. CI runs lint, typecheck, tests, the build, the smoke tests and the Pulumi checks. Read the review, resolve threads, and merge (squash).
2. The merge to `main` runs CI. When it succeeds, **Deploy web** starts and **waits for approval**. Open the run in the Actions tab, choose **Review deployments**, tick `production` and approve.
3. The job builds with `SITE_URL` and `PUBLIC_ALLOW_INDEXING` from the environment, uploads in three passes, invalidates the CloudFront cache and runs the smoke tests against the live site. It is green only if all of that passed.
   - Hashed files (`_astro/*`, `library-data/*.<hash>.json`) are uploaded first, with a one-year `immutable` cache header. Old hashed files are never deleted, so a tab opened before the deploy keeps working.
   - Icons, `robots.txt` and the sitemaps use a one-hour cache.
   - HTML is uploaded last and always revalidates. Pages and plain files the build no longer has are deleted from the bucket.
4. Check the site: [https://app.winmetta.org/](https://app.winmetta.org/), a page you changed, and `/robots.txt`.

To deploy without a merge (for example a content fix that must go out now, or the first run after a settings change), use **Actions > Deploy web > Run workflow**, pick `main` and a `ref`. Or from a terminal: `gh workflow run deploy-web.yml --ref main -f ref=main`. It still waits for approval.

## 4. Roll back

Rolling back means deploying an earlier commit.

1. Find the last good commit and get its **full 40-character SHA**: `git log --format='%H %s' -n 15 main`, or the summary line of the last green **Deploy web** run (it shows the full SHA). An abbreviated SHA, such as the one `git log --oneline` prints, does not work: the checkout step cannot resolve it, and the workflow stops with a message saying so. `git rev-parse <short sha>` turns a short SHA into the full one. A branch or a tag name is also accepted.
2. **Actions > Deploy web > Run workflow**, branch `main`, `ref` = the full SHA. From a terminal: `gh workflow run deploy-web.yml --ref main -f ref=<full sha>`.
3. Approve the deployment (§3, step 2). The job builds that commit, uploads it, deletes the pages the bad release added, invalidates the cache and runs the smoke tests.
4. Check the site, then fix forward with a normal pull request. Do not leave `main` ahead of what is live without knowing it: the next merge deploys `main` again.

Notes:

- Hashed files from the bad release stay in the bucket. They are harmless and unreferenced.
- If a single file was overwritten wrongly, the bucket is versioned: restore the previous version of the object with `aws s3api list-object-versions` and `aws s3api copy-object` (or the console), then invalidate its path.
- Rollback drill: not yet done. Do one once, then record the date and result in §11.

## 5. Manual publish when GitHub Actions is down

Only for an emergency, with `winmetta-admin` (`aws sso login --profile winmetta-admin` first) and `gh` signed in. Build with the values the `production` environment uses, so the live indexing state does not change, then upload in the same order as the workflow and invalidate:

```bash
(
  # A subshell with strict mode: any failure stops everything below and leaves your shell open.
  set -euo pipefail
  export AWS_PROFILE=winmetta-admin AWS_PAGER="" AWS_REGION=us-east-1
  prod_var() { gh variable get "$1" --env production; }   # reads the production environment variables
  site_url="$(prod_var SITE_URL)"; indexing="$(prod_var PUBLIC_ALLOW_INDEXING)"
  bucket="$(prod_var SITE_BUCKET)"; dist_id="$(prod_var CLOUDFRONT_DISTRIBUTION_ID)"
  for v in "$site_url" "$indexing" "$bucket" "$dist_id"; do
    [ -n "$v" ] || { echo "a production environment variable is empty" >&2; exit 1; }
  done
  rm -rf apps/web/dist   # a failed build must never leave an old copy that gets uploaded
  SITE_URL="$site_url" PUBLIC_ALLOW_INDEXING="$indexing" npm run build
  [ -f apps/web/dist/index.html ] || { echo "the build produced no site" >&2; exit 1; }
  D=apps/web/dist; B="$bucket"
  aws s3 sync $D/_astro "s3://$B/_astro" --cache-control "public, max-age=31536000, immutable" --size-only
  aws s3 sync $D/library-data "s3://$B/library-data" --cache-control "public, max-age=31536000, immutable" --size-only
  aws s3 sync $D "s3://$B" --exclude "*.html" --exclude "_astro/*" --exclude "library-data/*" --delete --cache-control "public, max-age=3600"
  aws s3 sync $D "s3://$B" --exclude "*" --include "*.html" --delete --cache-control "public, max-age=0, must-revalidate"
  aws cloudfront create-invalidation --distribution-id "$dist_id" --paths "/*"
)
```

Because `SITE_URL` and `PUBLIC_ALLOW_INDEXING` come from the environment variables, an emergency publish after launch keeps indexing on, and before launch keeps it off. Do not type them by hand.

## 6. Change the infrastructure

- **Open a pull request** that changes `infra/pulumi/`. The `Pulumi preview` check runs `pulumi preview` and shows the diff in the log of its `Pulumi preview` step, where the account ID is masked. The workflow deliberately does not put the diff in the run summary, because summaries are not masked. A pull request without infrastructure changes passes that check immediately.
- **Apply by hand,** after review and merge (or before, for an urgent fix, then merge the code): `aws sso login --profile winmetta-admin`, then `export AWS_PROFILE=winmetta-admin AWS_REGION=us-east-1` (logging in does not select the profile; without it the AWS tools use `default` or fail), `cd infra/pulumi`, `pulumi login s3://winmetta-pulumi-state`, `pulumi preview --stack production --diff`, read it, then `pulumi up --stack production`. Only a maintainer runs `pulumi up`.
- **Protected resources:** the Route 53 zone and the site bucket are protected from deletion. Replacing either would change the name servers or lose the site, so a preview that shows a replacement of them needs a decision, not a click.
- **Drift:** the preview does not refresh from AWS, so it shows code changes only. After a console change, run `pulumi refresh` (a write to the state, so confirm first) or undo the console change.
- **Trust policies match GitHub's immutable OIDC subject,** which has the organization and repository names and IDs. Renaming the organization or the repository, transferring it, or re-creating it needs `githubSubjectPrefix` updated and applied. See [infra/pulumi/README.md](../infra/pulumi/README.md).
- The preview role is read-only on purpose. If a future change makes it fail with `AccessDenied` on the Pulumi locks, read the README note before granting anything.

## 7. Set it up from nothing (or rebuild it)

Needs `winmetta-admin`, a clone of this repository with `mise` active, and the DreamHost panel. Never put the account ID in a file. Sign in with `aws sso login --profile winmetta-admin` and run `export AWS_PROFILE=winmetta-admin AWS_REGION=us-east-1` in the shell you use for every step below.

Which case are you in? The two recovery cases are guidance that has not been tried on a real failure: use them as a checklist, check each result before the next action, and ask another maintainer if you can.

- **A new account, or nothing exists:** follow steps 1 to 8.
- **The state bucket and the KMS key exist, but resources were deleted outside Pulumi:** do the seven actions below in order instead of setup steps 1 to 8. They replace setup step 1 (the bootstrap), the stack creation in setup step 2 (the `git rm` and `pulumi stack init`), setup step 3 (the config is already in the stack file), setup step 5 (the delegation) and setup step 7 (the GitHub settings), none of which is lost in this case.
  1. **Check the bootstrap resources.** Pulumi does not manage the GitHub OIDC provider, the state bucket or the KMS key, and neither `pulumi refresh` nor `pulumi up` recreates them. Run `AWS_PROFILE=winmetta-admin ./infra/bootstrap/bootstrap.sh` (a dry run, safe to repeat). It prints `ok` for the state bucket, the KMS key and the OIDC provider that exist, and a `[dry run] aws ... create-...` line instead for one that is missing (the bucket's settings are always listed, because the script re-applies them harmlessly). If anything is missing, rerun it with `--apply`. Without the OIDC provider both deployment roles are unusable by GitHub Actions.
  2. **Prepare the project.** `cd infra/pulumi`, `npm install` and `pulumi login s3://winmetta-pulumi-state`. Pulumi reads the project from the current directory, and the program needs its dependencies.
  3. **Refresh.** `pulumi refresh --stack production`. It writes to the state, so confirm before running it. It removes the missing resources from the state; without it Pulumi still believes they exist and the apply fails.
  4. **Leave `delegationConfirmed` as it is** (`true` for a live site). Removing it makes Pulumi delete the certificate, the distribution, the alias records, the bucket policy and the deploy role, which is an outage.
  5. **Preview and apply** (unless the zone is gone, see the edge cases). `pulumi preview --stack production --diff`, check that it only creates what was lost, then `pulumi up --stack production`.
  6. **Only if the Route 53 zone itself was deleted** (a new zone has new name servers): remove the flag and follow steps 4 to 6 of the setup (apply stage 1, redo the DreamHost delegation, then set the flag again).
  7. **Afterwards, whichever of these were recreated.** If the distribution was recreated it has a new ID, so set the `production` environment variable `CLOUDFRONT_DISTRIBUTION_ID` to `pulumi stack output distributionId` (the next deploy uploads the site and then fails at the cache invalidation if it still has the old ID). If the site bucket was recreated it is empty and the site returns 403 until a deploy: run **Deploy web** (§3) and check the site. Pulumi manages no site files.

  Edge cases for these six actions (rare, so they are notes, not extra procedure):

  - **The Route 53 zone is gone.** Check before action 5: `aws route53 list-hosted-zones-by-name --dns-name app.winmetta.org --max-items 1` should list the zone. If it does not, do action 6 instead of action 5. With `delegationConfirmed` still `true`, the apply would wait for the certificate to validate against a delegation that no longer exists, and re-staging afterwards would delete the stage-two resources that were just created.
  - **The KMS key is missing.** Stop and use the lost-state case below. `bootstrap.sh --apply` would create a different key under the same alias, and the committed `encryptedkey` in `Pulumi.production.yaml` is ciphertext for the lost key, so the stack could not be opened. Only a missing OIDC provider or missing bucket settings can be repaired in place with `--apply`. A missing state bucket is also the lost-state case.
  - **The state bucket has a custom name** (bootstrap needed `BUCKET=<other name>`, see setup step 1). The name is the `stateBucketName` value in `infra/pulumi/Pulumi.production.yaml`. Use it in `BUCKET=<name> ./infra/bootstrap/bootstrap.sh` (otherwise the check reports the default bucket missing) and in `pulumi login s3://<name>`.
- **The Pulumi state or its KMS key is lost, but the AWS resources still exist:** do **not** follow these steps. A blank stack would collide with the live resources (the bucket and the IAM roles have fixed names). Either import each surviving resource into a new stack (`pulumi import`, see Pulumi's import documentation), or delete the old resources first. Deleting the site bucket is safe because the site is rebuilt from git. Deleting the Route 53 zone changes its name servers, so the delegation in DreamHost must then be redone. This case is rare, so do it with another maintainer if you can, and write down what you did here.

1. **Bootstrap** (once per account): `AWS_PROFILE=winmetta-admin ./infra/bootstrap/bootstrap.sh` is a dry run. Read it, then add `--apply`. It creates the state bucket, the KMS key and the GitHub OIDC provider. If the bucket name is taken, rerun with `BUCKET=<other name>`, and then use that name everywhere the default `winmetta-pulumi-state` appears: in `pulumi login s3://<other name>` below, in `pulumi config set stateBucketName <other name>` (the preview role reads that bucket), and in the `cloud-url` of `.github/workflows/pulumi-preview.yml`. Commit the workflow change in a pull request.
2. **Stack:** in `infra/pulumi`, run `npm install`, `pulumi login s3://winmetta-pulumi-state`, then `pulumi stack init production --secrets-provider "awskms://alias/winmetta-pulumi?region=us-east-1"`. Before `stack init`, remove the committed `infra/pulumi/Pulumi.production.yaml` (`git rm`): it belongs to the old stack. Its encrypted data key can only be opened with the old KMS key, and it already says `delegationConfirmed: "true"`, which would skip the staged apply below. `stack init` writes a new file. Commit it; it has no secrets.
3. **Config:** set `githubSubjectPrefix` to the value from `gh api repos/winmetta/winmetta-platform/actions/oidc/customization/sub --jq .sub_claim_prefix`.
4. **Stage 1 apply** (for a first setup, or when the zone was lost; `delegationConfirmed` must be unset: check with `pulumi config`, and run `pulumi config rm delegationConfirmed` if it is there): `pulumi preview`, then `pulumi up`. This creates the zone, the bucket and the CloudFront pieces that do not need DNS. `pulumi stack output nameServers` lists the four name servers.
5. **Delegate:** in the DreamHost DNS panel add four `NS` records for the name `app`, one per name server, and change nothing else. Check delegation by asking public resolvers for the zone's own SOA record (it exists only in the new zone), not for the NS records, which DreamHost may not show:
   `dig +short SOA app.winmetta.org @1.1.1.1` and `@8.8.8.8` should return a `ns-….awsdns-…` answer.
6. **Stage 2 apply:** `pulumi config set delegationConfirmed true`, `pulumi preview`, `pulumi up`. This creates the certificate, its validation record, the distribution (about 10 minutes), the bucket policy, the alias records and the deploy role. Commit `Pulumi.production.yaml`.
7. **GitHub:** create the `production` environment with a required reviewer and the `main` branch only, and set its variables `SITE_URL`, `PUBLIC_ALLOW_INDEXING`, `SITE_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID` (the last two from the stack outputs). Set `PUBLIC_ALLOW_INDEXING` to `false` for a first setup. When you are recovering a site that has already launched, set the value it had (`true`, see §8): otherwise the first deploy brings back `noindex` and removes the sitemap. If the environment still exists, its variable is still there; check it with `gh variable get PUBLIC_ALLOW_INDEXING --env production`. Set the repository secret `AWS_ACCOUNT_ID` (`gh secret set AWS_ACCOUNT_ID --body "$(aws sts get-caller-identity --query Account --output text)"`).
8. **First deploy:** Actions > Deploy web > Run workflow, `ref` `main`, then approve (§3). Check the site.

## 8. Switch indexing on (launch)

Done on 2026-10-23, before the launch reviews (see the open todos in the backlog, [implementation-plan.md](implementation-plan.md) §6.1); repeat this procedure after rebuilding from nothing. Indexing is controlled in one place, the build variable, and nothing else (CloudFront adds no robots header).

1. Set the `production` environment variable `PUBLIC_ALLOW_INDEXING` to exactly `true` (any other value keeps `noindex`).
2. Run the deploy (§3) so the site is rebuilt: the `noindex` meta tag disappears and `robots.txt` gains the sitemap line.
3. Check: `curl -s https://app.winmetta.org/en/ | grep robots` returns nothing and `curl -s https://app.winmetta.org/robots.txt` lists the sitemap.
4. Link the site from `winmetta.org`. To go back, set the variable to `false` and deploy again.

## 9. Troubleshooting

| Symptom                                                                                   | Likely cause and fix                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy fails at "Sign in to AWS" with `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The role's trust policy does not match the token's subject. Check `githubSubjectPrefix` against `gh api repos/winmetta/winmetta-platform/actions/oidc/customization/sub`, apply, and re-run. It also happens if the run is not on the `production` environment. |
| Deploy or preview fails with "AWS_ACCOUNT_ID is not set"                                  | The repository secret is missing. Set it (§7, step 7).                                                                                                                                                                                             |
| Deploy waits forever                                                                      | It needs a reviewer: Review deployments on the run page.                                                                                                                                                                                           |
| Site returns 403 for every page                                                           | The bucket is empty or `index.html` is missing. Deploy.                                                                                                                                                                                            |
| Old content after a deploy                                                                | The invalidation did not finish, or a browser cached it. HTML revalidates, so wait a minute or invalidate `/*` again.                                                                                                                              |
| Smoke test fails on canonical URLs                                                        | The build used the wrong `SITE_URL`. The tests expect the origin of `BASE_URL`. Fix the environment variable and redeploy.                                                                                                                         |
| `pulumi` says `Failed to refresh cached SSO credentials`                                  | Export temporary credentials (§2).                                                                                                                                                                                                                  |
| Certificate stays pending in stage 2                                                      | Delegation is not live. Check the four DreamHost NS records and the SOA test (§7, step 5).                                                                                                                                                         |
| A pull request shows no Pulumi diff                                                       | It changed no file under `infra/pulumi/`, so the check did nothing, on purpose.                                                                                                                                                                    |
| Account ID visible in a log                                                               | A value was stored as a variable, or printed by a step. Move it to a secret, delete the runs (`gh run delete <id>`), and rescan the remaining runs.                                                                                                |

## 10. Cost and alerts

CloudFront is pay-as-you-go, and the Route 53 zone costs about $0.50 a month. S3, KMS and ACM are pennies at this size. A monthly AWS budget alert exists. If the bill is not small after the first month, revisit the CloudFront choice recorded in the plan.

## 11. Rollback drill log

| Date | Who | Commit rolled back to | Result |
| ---- | --- | --------------------- | ------ |
| _not yet done_ | | | |
