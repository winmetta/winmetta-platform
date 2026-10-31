# Runbook (moved to the private repository)

The operations runbook for `app.winmetta.org` and the analytics server (deploy, roll back, change the infrastructure, set everything up from nothing, troubleshooting, cost and alerts) now lives in the private companion repository **`winmetta/winmetta-platform-private`**, at `docs/runbook.md`. It describes how Win Metta operates its cloud account, access and people, which is internal information (see [AGENTS.md](../AGENTS.md) §2). Access to that repository is on request to the maintainers.

What stays here, in public:

- **How the site is built and deployed:** [tech-architecture.md](tech-architecture.md) §6-§8 and the workflows in `.github/workflows/`. Merging to `main` builds the site and, after a maintainer approves the `production` environment, publishes it.
- **The infrastructure code and its README:** [`infra/pulumi/`](../infra/pulumi/README.md).
- **The analytics design and rules:** [analytics.md](analytics.md).
- **Local development:** [developer-guide.md](developer-guide.md).

Other documents in this repository still mention "the runbook". That is the private one.
