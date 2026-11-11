# infra/pulumi

Pulumi (TypeScript) program for `app.winmetta.org` (day-to-day operation is in the runbook, now in the private repository; see [docs/runbook.md](../../docs/runbook.md)): a private S3 bucket behind
CloudFront (origin access control), an ACM certificate, a Route 53 zone and the
GitHub OIDC deploy role. One stack, `production`, all in `us-east-1`. Design:
[tech-architecture.md](../../docs/tech-architecture.md) §6-§8. Plan:
[implementation-plan.md](../../docs/implementation-plan.md) §4, step 3.

| Resource                               | Purpose                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Route 53 zone                          | `app.winmetta.org`, delegated from DreamHost. Protected from deletion.                                         |
| S3 bucket                              | Private, versioned, encrypted. Only the distribution can read it. Protected from deletion.                     |
| CloudFront function                    | `functions/viewer-request.js`: directory index and trailing-slash redirect. Tested.                            |
| Response headers policy                | Security headers (HSTS, nosniff, frame, referrer, permissions). No CSP and no robots header.                   |
| ACM certificate                        | DNS-validated through Route 53 (it must be in `us-east-1`).                                                    |
| CloudFront distribution                | Pay-as-you-go, `PriceClass_All`, 403 and 404 answered with `/404.html` and a real 404 status.                  |
| Alias records (A and AAAA)             | `app.winmetta.org` to the distribution.                                                                        |
| IAM role `winmetta-app-pulumi-preview` | GitHub OIDC for pull requests of this repo; read-only on the Pulumi state plus `kms:Decrypt` on the stack key. |
| IAM role `winmetta-app-deploy`         | GitHub OIDC, `production` environment of this repo only; sync the bucket and invalidate.                       |
| Analytics server (`analytics.ts`)      | Off unless the stack config `analyticsEnabled` is true: EC2 + VPC, data volume, snapshots, backup bucket, SNS topic and one status alarm. Server code in `../analytics/`; operation in the private runbook. |

The `winmetta-app-pulumi-preview` role (below) lets the `Pulumi preview` workflow run `pulumi preview` on pull requests.

## Prerequisites

Install the tools with `../../../bootstrap-dev-env/bootstrap.sh` (Pulumi comes from
mise). Type checks and tests need no AWS access. In this folder:

```bash
npm install
npm run typecheck
npm ci --prefix ../feedback
npm run feedback:build --prefix ../..
npm test
```

## Operating the stack

Every step that signs in to AWS or changes the live account (the one-time bootstrap,
creating the stack, the staged first apply with the DNS delegation, `pulumi up`,
refreshing, rebuilding, and setting the repository secret) is in the operations runbook
in the private companion repository `winmetta/winmetta-platform-private` (access on
request). This README explains what the program defines and why. Only maintainers run
`pulumi up`, after reading `pulumi preview`.

## Why `encryptedkey` is committed

`Pulumi.production.yaml` holds an `encryptedkey` line. It looks like a secret, but it is
ciphertext and safe to commit; Pulumi needs it to unlock the stack.

- With the KMS secrets provider (`awskms://alias/winmetta-pulumi`), Pulumi asks AWS KMS
  for a random **data key** when the stack is created. It uses that key to encrypt the
  stack's secret config values and state, and it stores the data key in this file,
  **encrypted by the KMS key**. That stored value is `encryptedkey`.
- To work on the stack, Pulumi sends `encryptedkey` to KMS (`kms:Decrypt`) and gets the
  data key back for that session. Without the line, nobody (a teammate, CI) could
  decrypt the stack's secrets.
- Reading the ciphertext in this public repo gives an attacker nothing: decrypting it
  needs `kms:Decrypt` on the `winmetta-pulumi` key, which only the allowed IAM roles have
  (the administrators' SSO role today, and the Pulumi preview role later). Keep that
  access narrow.
- Phase 2 has no secrets, so the key encrypts nothing yet. The KMS provider stays so
  adding a secret later needs no migration.
- **Never delete the KMS key** (`alias/winmetta-pulumi`). Without it `encryptedkey` and
  anything encrypted with it cannot be decrypted. Key rotation is on and is safe.
- Do commit `Pulumi.production.yaml` after every `pulumi config set`. Never commit
  plaintext secrets, state files or `.env` files.
- gitleaks flags the value as a generic API key. `.gitleaks.toml` allows exactly this
  KMS ciphertext shape (it matches the secret, not the file, so a real credential added
  to the same file is still caught). Don't remove the line or silence the rule more
  widely.

## Why the first apply is staged

ACM validates the certificate through DNS, which only works once DreamHost delegates
`app` to the new Route 53 zone. So the first apply runs with `delegationConfirmed` unset
(zone, bucket and the CloudFront pieces that need no DNS), the delegation is added, and
a second apply with `delegationConfirmed` set to `true` creates the certificate, the
distribution, the alias records and the deploy role. Never unset the flag on a live
stack: Pulumi would delete those resources.

## GitHub OIDC subject (why the config has numeric IDs)

The deploy role trusts GitHub's OIDC token only when its `sub` claim equals
`<githubSubjectPrefix>:environment:production`. This repository uses GitHub's
**immutable subject**, so the prefix is `repo:winmetta@<org id>/winmetta-platform@<repo id>`:
the names **and** the numeric IDs of the `winmetta` organization and of this repository.
The IDs are the part that cannot be faked: a new repository that reuses this one's name
after it is deleted gets a different ID, so its tokens do not match and it cannot assume
the role. Both IDs are public and are not secrets. The AWS account ID is a different
thing and stays out of the repository.

The names are still in the string and the trust policy matches it exactly, so renaming
the organization or the repository changes the subject and deploys fail (safely) until
the prefix is refreshed, see below.

If the trust policy uses the name form instead, the deploy fails at "Sign in to AWS with
the deploy role" with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. The
prefix must be refreshed in the stack config after any of: renaming the organization,
renaming the repository, transferring it, or deleting and re-creating it (the last two
also change the repository ID). How: the private operations runbook.

## Pull request previews

`.github/workflows/pulumi-preview.yml` runs `pulumi preview` on pull requests that touch
`infra/pulumi/` and shows the diff in the log of its `Pulumi preview` step. It assumes the
`winmetta-app-pulumi-preview` role through GitHub OIDC. A pull request has no
environment, so the role trusts the subject `<githubSubjectPrefix>:pull_request` (see the
section above). The role can only:

- read the Pulumi state bucket,
- decrypt the stack's data key with the stack's KMS key (a stack with no secrets still
  keeps an encrypted data key), and
- read the two CloudFront data sources the program uses.

It cannot change anything and cannot read the site, the other buckets or other
resources. Fork pull requests get no OIDC token, so the job is skipped for them. A pull
request from a branch of this repository can run it, even one that edits the workflow,
so keep the role this small. That is acceptable while the stack has no secrets; revisit
the trust before one is added.

Both workflows build the role ARNs from the repository secret `AWS_ACCOUNT_ID`
(`arn:aws:iam::<account id>:role/winmetta-app-pulumi-preview` and
`.../winmetta-app-deploy`). This repository is public and GitHub never masks variables in
the logs, so the account ID must be a secret, which GitHub masks wherever it appears.

The workflow does not put the Pulumi diff in the run summary (it only writes a one-line
note when there is nothing to preview). GitHub masks secrets in logs but not in summaries,
and a diff that touches an IAM resource shows ARNs with the account ID, so the diff is
read in the log of the `Pulumi preview` step, where `AWS_ACCOUNT_ID` is masked.

The preview does not refresh from AWS, so it shows code changes, not drift made by
hand. It also needs no write access to the state: without `--refresh` it takes no stack
lock and writes nothing (checked on the first run, which succeeded with the read-only
role and left no object in the versioned state bucket). Pulumi's documentation lists
`preview` among the operations needing `s3:PutObject` and `s3:DeleteObject`; if a
future change such as `--refresh` makes the workflow fail with `AccessDenied` on
`.pulumi/locks/`, grant those on that prefix only, and note that a pull request could
then hold a lock and block `pulumi up`. Only maintainers run `pulumi up`, after reading the preview.

## Config

| Key                   | Default                                                     |
| --------------------- | ----------------------------------------------------------- |
| `domain`              | `app.winmetta.org`                                          |
| `githubRepo`          | `winmetta/winmetta-platform`                                |
| `githubEnvironment`   | `production`                                                |
| `githubSubjectPrefix` | `repo:<githubRepo>`; set to the immutable prefix above      |
| `stateBucketName`     | `winmetta-pulumi-state` (the preview role reads it)         |
| `stateKeyAlias`       | `alias/winmetta-pulumi` (the preview role decrypts with it) |
| `siteBucketName`      | `winmetta-app-production-site`                              |
| `delegationConfirmed` | `false` (`true` once the DNS delegation works, see above)   |

Never put the account ID, keys or other secrets in config or code.


## Feedback component (disabled by default)

`feedback.ts` defines the Lambda, an IAM-authenticated Function URL accessed using CloudFront OAC, the feedback SNS topic, a 14-day log group and a daily volume
alarm. The distribution adds a non-cached `/api/feedback` behavior only when enabled,
with no static-site URL rewrite and no forwarding of viewer cookies or queries.
The two invocation grants are limited to this CloudFront distribution. The function
can publish only to the feedback topic and write only its own logs.

| Config | Default / purpose |
| --- | --- |
| `feedbackEnabled` | `false`; creates nothing until explicitly enabled |
| `feedbackConcurrency` | `2`; accepted values `0`, `1`, `2`; zero stops invocations |
| `feedbackAlertTopicArn` | Required only without analytics; otherwise the analytics alert topic is reused |

The deployment archive is built with the root command `npm run feedback:build`
after installing `infra/feedback` dependencies. CI installs, tests and builds it
before the Pulumi tests. Mock tests do not contact AWS. The public design lists
remaining deployment gates in [docs/feedback.md](../../docs/feedback.md) §10.
Before adding a secret to this stack, the preview-role trust must be reviewed as
required in "Pull request previews" above. Live operations, subscriptions and
recipient/filter details belong in the private companion runbook.
