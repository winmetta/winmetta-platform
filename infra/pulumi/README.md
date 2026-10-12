# infra/pulumi

Pulumi (TypeScript) program for `app.winmetta.org`: a private S3 bucket behind
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

The `winmetta-app-pulumi-preview` role (below) lets the `Pulumi preview` workflow run `pulumi preview` on pull requests.

## Prerequisites

Do the one-time bootstrap first (`../bootstrap/bootstrap.sh`) and install the tools
with `../../../bootstrap-dev-env/bootstrap.sh` (Pulumi comes from mise). Then, in this
folder:

```bash
npm install
npm run typecheck
npm test
```

## Login

```bash
aws sso login --profile winmetta-admin
export AWS_PROFILE=winmetta-admin AWS_REGION=us-east-1
pulumi login s3://winmetta-pulumi-state
```

If Pulumi reports "Failed to refresh cached SSO credentials", export temporary
credentials for the shell instead:
`eval "$(aws configure export-credentials --format env)"`.

## Create the stack (once)

This writes to the state bucket and creates a data key with KMS. Commit the resulting
`Pulumi.production.yaml`: it holds no secrets (Phase 2 has none), only the stack
settings and the encrypted data key.

```bash
pulumi stack init production --secrets-provider "awskms://alias/winmetta-pulumi?region=us-east-1"
```

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
  (the `winmetta-admin` profile today, and the Pulumi preview role later). Keep that
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

## Staged first apply

ACM DNS validation needs the delegation from DreamHost to be live, so the first apply
has two stages. `pulumi up` changes AWS: a maintainer runs it by hand, after reading
`pulumi preview`.

1. **Zone and supporting resources.** `delegationConfirmed` is unset (false):

   ```bash
   pulumi preview
   pulumi up
   pulumi stack output nameServers
   ```

2. **Delegate.** In the DreamHost DNS panel add four `NS` records for `app` with
   those name servers. Check delegation by resolving a record that exists only in
   the new zone (for example a temporary `TXT` record) through a public resolver,
   not by looking up the `NS` records: DreamHost warns that subdomain `NS` records
   may not show up in public `dig` lookups.

3. **Certificate, distribution, records and deploy role:**

   ```bash
   pulumi config set delegationConfirmed true
   pulumi preview
   pulumi up
   ```

   Commit the changed `Pulumi.production.yaml`. The certificate validation can take a
   few minutes, and a new distribution takes about 10 to 15 minutes to deploy.

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
the deploy role" with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. To read
the value GitHub uses:

```bash
gh api repos/winmetta/winmetta-platform/actions/oidc/customization/sub --jq .sub_claim_prefix
```

Set it with `pulumi config set githubSubjectPrefix <value>` and apply. Repeat this after
any of: renaming the organization, renaming the repository, transferring it, or deleting
and re-creating it (the last two also change the repository ID).

## Pull request previews

`.github/workflows/pulumi-preview.yml` runs `pulumi preview` on pull requests that touch
`infra/pulumi/` and shows the result in the run's summary. It assumes the
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

One-time setup, after the stack is applied: set the repository secret `AWS_ACCOUNT_ID`.
This repository is public and GitHub never masks variables in the logs, so the account
ID must be a secret, which GitHub masks wherever it appears. Both workflows build the
role ARNs from it (`arn:aws:iam::<account id>:role/winmetta-app-pulumi-preview` and
`.../winmetta-app-deploy`):

```bash
gh secret set AWS_ACCOUNT_ID --body "$(aws sts get-caller-identity --query Account --output text)"
```

A Pulumi diff in the run summary can still show an ARN when a change touches an IAM
resource. Summaries are not masked, so check a diff before sharing it.

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
| `delegationConfirmed` | `false` (set `true` for stage 3)                            |

Never put the account ID, keys or other secrets in config or code.
