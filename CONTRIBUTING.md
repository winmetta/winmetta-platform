# Contributing

Read [AGENTS.md](AGENTS.md), the [developer guide](docs/developer-guide.md) and the
[implementation plan](docs/implementation-plan.md).
Phase 0 contains only synthetic smoke pages; real content and deployments come later.

## Setup

On macOS, run `./scripts/bootstrap-macos.sh` from this directory. It installs missing
system tooling, nvm, Node 24, the npm version in `package.json`, and locked dependencies.
For an existing Node 24 installation, install the declared npm version and run `npm ci`.
Run `npm run dev`, then open http://localhost:4321. English and Burmese smoke pages
live at `/en/` and `/my/`. Canonical URLs use `SITE_URL` (default localhost), and pages send `noindex`
unless `PUBLIC_ALLOW_INDEXING=true`; see `.env.example`. Only the public production
build should enable indexing.

## Environment configuration

`.env.example` is committed documentation. For local overrides, copy it to `.env.local`
at the repository root; that file is ignored. Injected environment variables take
precedence over local values, and changes to `.env.local` invalidate the Turbo cache.
Restart the dev server after changing local values. No env file is needed for defaults.

When deployment is added, use GitHub `staging` and `production` environment variables
(and environment secrets for credentials), mapped explicitly into the build job.
Do not add `.env.staging` or `.env.production`. Add `.env.test` only if tests later
need separate configuration.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
Use `npm run format` to format code. Browser checks run after a build:
`npx playwright install chromium` then `npm run test:smoke`.
CI runs all these checks on pull requests; it does not deploy.

## Code and content

Keep code in `apps/web` until a second consumer needs a shared package. Add UI messages
in `src/i18n/messages`, and register additional locales centrally. Build validation
rejects missing/empty translation keys. Content schemas live in `src/lib/schemas.ts`;
Phase 0 collections load only `src/fixtures`. Synthetic examples use reserved domains.
Schedule weekdays use ISO Monday=1 through Sunday=7. Nonexistent daylight-saving times
are rejected; repeated times resolve to the earlier instant. Display both Pacific and
Myanmar dates using the occurrence instant, independently of UI language.

Propose code or content changes in a pull request explaining the purpose and checks.
Use Conventional Commit titles. Never include secrets, private meeting details, or
personal student information. Verified public content belongs in Phase 1; preserve
teacher attribution and do not rewrite teachings. Contact contact@winmetta.org for help.
