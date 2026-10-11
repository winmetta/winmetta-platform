# infra/pulumi

Pulumi (TypeScript) program for `app.winmetta.org`: a private S3 bucket behind
CloudFront (origin access control), an ACM certificate, a Route 53 zone and the
GitHub OIDC deploy role. One stack, `production`, all in `us-east-1`. Design:
[tech-architecture.md](../../docs/tech-architecture.md) §6-§8. Plan:
[implementation-plan.md](../../docs/implementation-plan.md) §4, step 3.

| Resource                     | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Route 53 zone                | `app.winmetta.org`, delegated from DreamHost. Protected from deletion.                        |
| S3 bucket                    | Private, versioned, encrypted. Only the distribution can read it. Protected from deletion.    |
| CloudFront function          | `functions/viewer-request.js`: directory index and trailing-slash redirect. Tested.           |
| Response headers policy      | Security headers (HSTS, nosniff, frame, referrer, permissions). No CSP and no robots header.  |
| ACM certificate              | DNS-validated through Route 53 (it must be in `us-east-1`).                                   |
| CloudFront distribution      | Pay-as-you-go, `PriceClass_All`, 403 and 404 answered with `/404.html` and a real 404 status. |
| Alias records (A and AAAA)   | `app.winmetta.org` to the distribution.                                                       |
| IAM role `winmetta-app-deploy` | GitHub OIDC, `production` environment of this repo only; sync the bucket and invalidate.    |

The Pulumi preview role arrives with the deploy workflow (plan step 5).

## Prerequisites

Do the one-time bootstrap first (`../bootstrap/bootstrap.sh`) and install the tools
with `../../.github/bootstrap-dev-env.sh` (Pulumi comes from mise). Then, in this
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

## Config

| Key                   | Default                         |
| --------------------- | ------------------------------- |
| `domain`              | `app.winmetta.org`              |
| `githubRepo`          | `winmetta/winmetta-platform`    |
| `githubEnvironment`   | `production`                    |
| `siteBucketName`      | `winmetta-app-production-site`  |
| `delegationConfirmed` | `false` (set `true` for stage 3) |

Never put the account ID, keys or other secrets in config or code.
