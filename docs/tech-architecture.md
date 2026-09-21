# Technical Architecture Specification

## 0. Scope Note: v1 Is a Single Web App

Per [prd.md](prd.md) §4.7 and §7, **v1 targets one mobile-responsive web app** — built with **Astro** (static-first, with React islands for the interactive lesson engine) — talking to a Fastify backend. Not a simultaneous Electron desktop build and Capacitor mobile build. This matches the platform's actual funding/volunteer-capacity constraints (see PRD §5) and lets the team validate the Burmese/Pāḷi literacy pilot before investing in native shells.

Electron desktop and Capacitor mobile remain **documented here as the intended Future Phase (PRD Phase 4) targets** so the shared-package boundaries (`packages/ui`, `packages/shared-types`, `packages/audio-core`) are designed to support them later without a rewrite — but nothing under `apps/desktop` or `apps/mobile` is built in Phase 0/1.

---

## 1. Foundation Stacks & Architecture Overview

Win Metta uses a unified TypeScript monorepo. The v1 architecture has a single client; desktop/mobile are additive later without changing the backend or shared packages.

```
                              +----------------------------+
                              |    Clients Monorepo        |
                              |  (Shared React Components  |
                              |   & Shared Types / Logic)  |
                              +--------------+-------------+
                                             |
                                             v
                              +--------------------------------+
                              |   Astro Web App (v1 — only client) |
                              |  Static-first pages (Dhamma Library, |
                              |  class directory) + React islands   |
                              |  for the literacy lesson engine.     |
                              |  Mobile-responsive, Unicode-only.    |
                              +--------------+-------------------+
                                             |
                    (Future Phase 4: Desktop [Electron] & Mobile [Capacitor]
                     attach here without backend changes)
                                             |
                                     HTTPS / REST
                                             |
                                             v
                              +----------------------------+
                              |     Backend Service        |
                              |  Fastify + TypeScript API  |
                              +--------------+-------------+
                                             |
                      +----------------------+----------------------+
                      |                                             |
                      v                                             v
           +--------------------+                        +--------------------+
           |   PostgreSQL 18    |                        |   Cloudflare R2    |
           | (optional accounts,|                        |  (Audio, Video,    |
           |  lesson progress)  |                        |   PDF, Images)     |
           +--------------------+                        +--------------------+

```

Note per PRD §4.6: core content (Dhamma Library, class directory, literacy lessons) must be usable with **no account and no login** — PostgreSQL is only in the critical path for the *optional* progress-sync feature (PRD Phase 3), not for reading or learning.

Note on rendering model: most pages (Dhamma Library, class directory, about/marketing) are pre-rendered to static HTML at build time for SEO and low-bandwidth resilience — see §2 and §4.2. The literacy lesson engine is a React island: a self-contained interactive app embedded in an otherwise static page, calling the Fastify API at runtime like a small SPA.

---

## 2. Technology Choices & Justification

Baseline versions below reflect current stable releases as of this writing (September 2026). Re-check before Phase 0 kickoff if significant time has passed.

| Layer | Selection | Version Baseline | Justification |
| --- | --- | --- | --- |
| **Runtime** | **Node.js** | **24.x (Active LTS, "Krypton")** | Current Active LTS with the longest support runway; ships npm 11 and a newer V8. Node 22 is Maintenance LTS only (EOL April 2027) — don't start a new project on it. |
| **Package Manager** | **npm** | **11.x** (bundled with Node 24) | No need for a separate package manager; npm 11 ships with the Node 24 LTS runtime. |
| **Monorepo Manager** | **Turborepo + npm workspaces** | **turbo ^2.11** | Fast, lightweight, zero cognitive overhead. Works with standard Node tooling only. |
| **Language** | **TypeScript** | **^6.0** | TypeScript 6.0 is the final release on the original JS-based compiler and the current recommended stable line. TypeScript 7 (Go-native rewrite) is in beta as of 2026 — track it, don't build on it yet. |
| **Backend API** | **Fastify (TypeScript)** | **^5.12** | Extremely low overhead, high throughput, built-in schema validation via TypeBox/JSON Schema, first-class TypeScript support. |
| **Database** | **PostgreSQL** | **18.x** | Relational integrity, rich JSON querying, native full-text search without extra infrastructure. PostgreSQL 19 is in beta — not for production yet. |
| **Web Client (v1, only client)** | **Astro**, with **React ^19.3** for islands | **Astro ^7.3** | Ships zero JS by default; pre-renders content pages (library, class directory) to static HTML for SEO and fast loads on the low-bandwidth/older-device conditions named in PRD §4.6, while still supporting a fully interactive React lesson engine as an island. Uses Vite ^8 internally, so tooling stays consistent with the rest of the stack. |
| **Styling & UI** | **Tailwind CSS + shadcn/ui** | **Tailwind ^4.3** | Headless, accessible primitives owned directly in the repo; immune to third-party npm deprecation. Works the same inside Astro pages and React islands. |
| **Asset CDN & Media** | **Cloudflare R2** | — | S3-compatible API with $0 egress fees — important for a dana-funded nonprofit streaming audio/video/PDFs (see PRD §5, low fixed-cost infrastructure). Kept outside Azure deliberately — see §6. |
| **Desktop Shell (Future Phase 4)** | **Electron + electron-vite** | Evaluate at build time | Deferred per PRD §4.7. Packaged with `electron-builder` for delta updates when built. |
| **Mobile Client (Future Phase 4)** | **Capacitor (wrapping React)** | Evaluate at build time | Deferred per PRD §4.7. Maximizes code reuse from the web codebase when built. |

---

## 3. Monorepo Organization & Code Layout

```
winmetta/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, typecheck, test
│       └── deploy-server.yml      # Build and deploy Fastify backend
├── apps/
│   ├── server/                    # Fastify API Service
│   │   ├── src/
│   │   │   ├── routes/            # Route modules (v1/lessons, v1/dhamma-library, v1/classes)
│   │   │   ├── plugins/           # Fastify plugins (db, cors, rate-limit)
│   │   │   ├── services/          # Business logic and R2 client
│   │   │   └── index.ts           # Server bootstrap
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/                       # Astro Web Application (v1 — only client)
│       ├── src/
│       │   ├── pages/              # File-based routes; static by default (library, classes, about)
│       │   ├── components/         # Astro components (static) + React islands (lesson engine)
│       │   └── content/            # Content collections (e.g. library metadata, class schedule)
│       ├── astro.config.mjs
│       └── package.json
├── packages/
│   ├── ui/                        # Shared UI components (shadcn/ui + Tailwind), usable from Astro or React islands
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── shared-types/              # Shared API request/response DTOs & DB schemas
│   │   ├── src/
│   │   │   ├── dhamma.ts
│   │   │   ├── lesson.ts          # Generic lesson schema; each record carries a `curriculum` code (e.g. "llb") and a separate `teacher` field — see note below
│   │   │   └── user.ts
│   │   └── package.json
│   ├── audio-core/                # Shared Web Audio API playback (class recordings, reading-practice audio)
│   │   ├── src/
│   │   │   └── audio-player.ts
│   │   └── package.json
│   └── tsconfig/                  # Shared base tsconfig files
├── scripts/
│   ├── bootstrap-macos.sh         # Native macOS developer onboarding script
│   └── db-migrate.sh              # Local migration runner
├── .nvmrc                         # Node LTS version lock (24.x)
├── AGENTS.md                      # Agent and LLM workspace guide
├── CLAUDE.md -> AGENTS.md         # Symlink to AGENTS.md
├── package.json                   # Root package definition (npm workspaces)
├── turbo.json                     # Turborepo task pipeline definition
└── LICENSE                        # MIT License

```

`apps/desktop/` (Electron) and `apps/mobile/` (Capacitor) are intentionally **not present in Phase 0/1** — they are added under `apps/` in Future Phase 4 once the web app has validated real usage, reusing `packages/ui`, `packages/shared-types`, and `packages/audio-core` as-is.

**Naming note on `lesson.ts`:** avoid the bare word "lesson" when referring to actual content, and avoid grouping content by subject (e.g. a generic "Pāḷi track") — organize by the **actual class name Win Metta already uses**, the same way LLB does. A lesson record's `curriculum` field identifies which specific class it belongs to, and `teacher` is a separate field, since a curriculum isn't modeled as belonging to its current teacher personally (they may be joined or succeeded by others). Known curricula so far, per PRD §4.2:

| `curriculum` code | Class name (as taught today) | Current teacher |
| --- | --- | --- |
| `llb` | Let's Learn Burmese | Ven. U Garudhamma |
| `pgtp` | Pāḷi Saddā & Tipiṭaka Pāḷi (ပါဠိသဒ္ဒါ နှင့် တိပိဋကပါဠိ သင်တန်း) | Ven. U Garudhamma |
| *(unassigned)* | Sutta Piṭaka Study (မူရင်းသုတ္တန်ပိဋကတ်ပါဠိတော်ကို လေ့လာခြင်း သင်တန်း) | Ven. Kelāsa |

Note `llb` and `pgtp` share a teacher today but are still separate curricula — the `curriculum` field is keyed to the class, never inferred from who teaches it. Any future class (a new teacher, a new subject) gets added to this table with its own code before any content is digitized, rather than reusing an existing code loosely.

---

## 4. Architectural Flows

### 4.1. Content & Audio Delivery Flow (v1)

```
Astro Web App                            Fastify API               Cloudflare R2 CDN
       |                                      |                            |
       |--- 1. Static pages (library, classes) pre-rendered at build time  |
       |       — no Fastify call needed to view them                       |
       |                                                                   |
       |--- 2. Lesson engine (React island) requests lesson/audio ------->|
       |    metadata at runtime (no login required)                       |
       |<-- 3. Return metadata & CDN URL -----|                            |
       |                                                                   |
       |--- 4. Fetch stream or byte ranges ------------------------------->|
       |<-- 5. Audio/PDF bytes (cached for offline use) --------------------|

```

### 4.2. Static Rebuild & Content Refresh Flow (v1)

Static-site generation means content changes (a new class time, a newly digitized library text) don't appear until the site is rebuilt. This is a real operational step, not a one-time setup cost:

```
Content update (new library file, class schedule change)
       |
       v
Triggers CI rebuild (GitHub Actions: content merge, or a scheduled rebuild)
       |
       v
Astro build regenerates affected static pages
       |
       v
Deployed to Azure Static Web Apps (see §6)
```

Pages expected to change often (e.g., the live class schedule) can instead be marked for on-demand server rendering in Astro rather than waiting for a rebuild, if that lag becomes a problem in practice — evaluate this per-page rather than defaulting every page to one strategy.

### 4.3. Desktop Auto-Update & Delta Ingestion Flow (Future Phase 4 — not built in v1)

```
User App (Desktop)                GitHub Releases                 electron-updater
       |                                |                                |
       |--- 1. Check for updates ------>|                                |
       |    (Fetches latest.yml)        |                                |
       |                                |                                |
       |<-- 2. Manifest returned -------|                                |
       |    (Contains v1.1.0 info)      |                                |
       |                                |                                |
       |--- 3. Compare blockmaps --------------------------------------->|
       |                                                                 |
       |--- 4. HTTP Range Request (Only changed byte blocks) ----------->|
       |<-- 5. Receive 8MB diff instead of 100MB full binary ------------|
       |                                                                 |
       |--- 6. Verify checksum & prompt user to restart ---------------->|

```

Retained here only so the desktop build (when undertaken in Future Phase 4) doesn't need this flow re-designed from scratch.

---

## 5. Burmese Text Encoding: Unicode-Only (v1)

All Burmese-script content in the platform — UI strings, digitized curriculum, library metadata — uses **Unicode (Myanmar block, U+1000–U+109F)** exclusively. **Zawgyi**, the legacy non-Unicode Burmese font encoding still common on older devices, older PDFs, and much pre-2019 Facebook/Myanmar web content, is **explicitly out of scope for v1**.

**Why Zawgyi support may still be needed later:** Zawgyi and Unicode look similar when rendered but are byte-incompatible — mixing them without conversion produces garbled text. A meaningful share of existing Burmese material — potentially including some of Win Metta's own archived PDFs, older Facebook posts, or content contributed by Myanmar-based or older diaspora users — may still be authored in Zawgyi. If user-contributed content or older archival material needs to be ingested during Phase 2 (Dhamma Library digitization), a Zawgyi-detection/conversion step (well-precedented via open-source tools such as Google's `myanmar-tools`) would need to be added at that point. Noted here so it isn't rediscovered as a surprise mid-migration.

---

## 6. Hosting & Deployment

Win Metta has an approved **Azure for Nonprofits grant ($2,000/year)** and intends Azure to remain the long-term home for hosting — including if the grant lapses in a given year and hosting shifts to donation-funded (see PRD §5). Two constraints shape the plan below: the grant **only covers first-party Azure services** (no third-party marketplace spend), and it **does not roll over and must be reactivated annually** — a lapse year should be a planned-for scenario, not a surprise.

### Domain Structure

The existing **`winmetta.org` WordPress site is unchanged and unaffected by this repo** — it keeps serving the blog/news, About page, and existing class-info pages, and keeps its current non-technical content-publishing workflow. This platform lives on subdomains instead of replacing it:

| Subdomain | Points to | Purpose |
| --- | --- | --- |
| `winmetta.org` (+ `www`) | Existing WordPress hosting (unchanged) | Blog/news, About, existing static pages — untouched by this repo. |
| `app.winmetta.org` | Azure Static Web Apps (Astro build output) | This platform's frontend — LLB lessons, Dhamma Library, class directory, and (Phase 3) accounts. `app.` was chosen over `platform.` as the more immediately understandable label for the non-tech-fluent-elder persona (PRD §2). |
| `api.winmetta.org` | Azure Container Apps (Fastify) | The backend API, as a sibling subdomain rather than nested under `app.`, to keep the URL space simple. |

Both `app.` and `api.` are added as custom domains via CNAME records — supported on Azure Static Web Apps' and Container Apps' free/consumption tiers — with no changes required to how `winmetta.org` itself is hosted or managed. Cross-link between the two: the WordPress site's navigation can point to `app.winmetta.org`, and the app can link back to `winmetta.org` for blog/news content.

| Component | Where it's hosted | Why |
| --- | --- | --- |
| Astro static build output | **Azure Static Web Apps** (Free tier initially) | Just serves the static files Astro outputs — SSL, custom domain, and a CDN included free. The Free tier caps at 100GB bandwidth/month; kept comfortably under that by routing heavy media off this path entirely (see below). |
| Fastify API | **Azure Container Apps** (Consumption plan) | Runs Fastify as a plain Docker container. The Consumption plan's free monthly allowance (~180K vCPU-seconds) comfortably covers this traffic level and scales to zero when idle, keeping the cost floor low if the grant lapses. |
| PostgreSQL | **Azure Database for PostgreSQL – Flexible Server** (Burstable tier) | Standard wire-protocol Postgres, no Azure-only extensions — portable to any Postgres host if needed later. Burstable tier is the cheapest option and can be stopped when not in active use. |
| Audio, video, PDF, images | **Cloudflare R2** — deliberately *not* Azure Blob Storage | Two reasons: (1) **Cost predictability** — Azure bills internet egress at ~$0.087/GB after a shared 100GB/month free allowance across the whole subscription, while R2 is $0.00/GB egress always. Media is the cost category most likely to grow as the mission succeeds (more people streaming/downloading), and it's the category most likely to quietly burn through a capped, non-rolling-over grant. Since the grant can't be spent on R2 anyway (third-party service), this isn't a lost benefit — it's cost kept off the grant entirely. (2) **True portability** — R2's API is S3-compatible, so it moves to AWS S3, Backblaze, or self-hosted MinIO with no code changes; Azure Blob Storage's native API is not S3-compatible and would actually be the *least* portable piece of the stack. |

**Portability principle** (so the stack can move to AWS or a VPS if the grant situation changes): avoid Azure-specific SDKs or bindings inside application code. Concretely — run the API as a plain container (portable to ECS/Fargate, Fly.io, Render, or a bare VPS with `docker run`), use vanilla Postgres features only (portable via `pg_dump`/`pg_restore` to RDS, Fly Postgres, or self-hosted), read secrets from environment variables rather than calling the Azure Key Vault SDK directly from business logic, and access object storage through an S3-compatible client library (works unmodified against R2, AWS S3, or MinIO). The Astro static output is the most portable piece of all — moving it off Azure Static Web Apps later is a DNS change, not a rebuild.

**Sustainability note:** every component above has a near-zero floor at low traffic (Container Apps scales to zero, Static Web Apps Free tier, Postgres Burstable can be paused, R2 has its own low-volume free allowance). The transition from grant-funded to donation-funded hosting (PRD §5) should be a cost *reduction* at the same architecture, not a re-platforming exercise.

---

## 7. Environments & CI/CD

Two real environments plus free ephemeral previews — deliberately not a heavier multi-stage pipeline, since this will be maintained by a small/volunteer team (PRD §5).

| Environment | Domain | Purpose | Resources |
| --- | --- | --- | --- |
| **Production** | `app.winmetta.org` / `api.winmetta.org` (§6) | Live, congregation-facing | Full resource set from §6 (Static Web App, Container App, Postgres Flexible Server) + the production R2 bucket. Real data. |
| **Staging** | `staging.app.winmetta.org` / `staging.api.winmetta.org` | Pre-release verification | A second, minimal set of the same resource types — cheapest tiers (Postgres Burstable at its smallest size, Container App scaled to zero when idle) — plus a **separate R2 bucket** (e.g. `winmetta-media-staging`), so test uploads never mix with the real Dhamma Library. Synthetic or scrubbed data only, never a copy of real user data. |
| **PR previews** | Azure's auto-generated ephemeral hostname (not a custom subdomain — not worth naming something torn down within days) | Per-pull-request sanity check | Generated automatically by **Azure Static Web Apps** for every PR — a free, ephemeral preview URL of the Astro frontend, torn down when the PR closes. Points at the shared staging API/DB rather than provisioning a new backend per PR, to keep cost and operational overhead down. |

**Why staging gets a fully separate database, not just a separate schema:** given PRD §4.6's "no login, minimal data" commitment — especially for Myanmar-based users — a full separate Postgres instance makes it structurally impossible for a staging experiment, test script, or bug to touch real user data, rather than relying on query discipline within a shared instance.

**Staging must not be publicly discoverable.** Unlike production, `staging.app.winmetta.org` (and PR preview URLs) should: (1) send a `noindex` response header/meta tag so search engines never index pre-release content under the `winmetta.org` domain, and (2) sit behind a basic access restriction (Azure Static Web Apps supports simple access control on non-production environments) so a stray link doesn't expose unfinished features or test content to the public. This is a one-time setup step, easy to forget since it doesn't block anything in local development.

**CI/CD flow:**

1. **PR opened** → `ci.yml` runs lint/typecheck/build → Static Web Apps auto-deploys a PR preview of the frontend, pointing at staging's API.
2. **Merge to `main`** → auto-deploy to **staging** (both the Astro site and the Fastify container).
3. **Promotion to production** is a deliberate, separate step — a tagged release, or a GitHub Actions environment with a manual approval gate — not automatic on every merge to `main`. For a small team, a conscious approval step is a reasonable safety net in place of a heavier release process (canary rollouts, blue/green, etc.), which isn't worth the operational overhead at this scale.

---

## 8. Infrastructure Provisioning

**Terraform, not manual Azure Portal setup or Azure-only tooling (Bicep).** This follows the same portability reasoning already used throughout §6 (R2 over Azure Blob, avoiding Azure SDKs in application code, vanilla Postgres): if the Azure grant ever lapses and hosting has to move to AWS or a VPS, the team should be able to carry the same tool and workflow over — only the provider blocks change — rather than also having to learn a new, cloud-specific IaC language at the same moment a migration is already forcing change.

**Honest trade-off:** Terraform has a real learning curve and requires managing state, which is more overhead than clicking through the Portal or running ad hoc `az` CLI commands. For a very small, IaC-inexperienced volunteer team, a well-documented, idempotent `scripts/provision-azure.sh` (same pattern as the existing `bootstrap-macos.sh`) is a legitimate simpler starting point. Terraform is the recommended default given the staging/production duplication need and the project's existing portability principle, but this is worth the team explicitly confirming rather than assuming.

### Structure

```
infra/
├── modules/
│   └── platform/            # One module: resource group, Static Web App, Container App, Postgres Flexible Server
├── environments/
│   ├── production/          # Calls the module with production tiers/SKUs and names (§6, §7)
│   └── staging/             # Calls the same module with cheapest tiers and staging- prefixed names (§7)
```

Staging and production stay structurally identical by construction (one shared module, different parameters) rather than by manually keeping two hand-written configurations in sync.

**State storage:** Terraform Cloud's free tier, rather than standing up an Azure Storage Account solely to hold state — one fewer self-managed resource, plus free remote locking so two people don't apply changes at the same time.

### Where this fits with the CI/CD in §7

Infrastructure changes are a **separate, more deliberately-gated flow** from the app-deploy pipeline in §7 — a bad `terraform apply` can take down the database, which is a different risk profile than shipping a new build of the app. `terraform plan` runs and posts its output on any PR touching `infra/`; `terraform apply` requires a manual trigger by a maintainer, never auto-applied on merge the way the app's staging deploy is.

**CI auth:** an Azure Service Principal scoped to only the resource group(s) it needs (not subscription-wide), stored as a GitHub Actions secret.

**Secrets note:** using Container Apps' built-in secret/environment-variable injection (optionally backed by Azure Key Vault at the infrastructure level) to hand the Fastify app its `DATABASE_URL`, R2 credentials, and Better Auth secret is fine and doesn't violate the "no Azure SDK in business logic" principle from §6 — the application code just reads plain environment variables either way; Key Vault, if used, is only involved at deploy time and is invisible to the app itself.

---

## 9. Experimentation / A/B Testing (Future Plan)

Not needed for v1 — deferred until there's a concrete, mission-aligned question worth testing (e.g., does one lesson-pacing approach produce a better return-to-learn rate than another, per the PRD §6 success metrics). Noted here now so the approach is decided in advance rather than reached for reflexively later:

* **Not for engagement optimization.** Classic growth-hacking A/B testing (optimizing button color/copy for clicks or session length) conflicts directly with the Calm by Default and no-vanity-metrics principles (PRD §3, §6). Any future experiment should be framed around a learning-outcome question, not an engagement metric.
* **Planned tooling: GrowthBook, self-hosted**, over PostHog or a commercial platform, when the time comes — free to self-host with no limits on flags/experiments, and **warehouse-native**: it reads experiment results from Win Metta's own Postgres rather than shipping user events to a third-party vendor, which matters given the no-identity-linked-tracking commitment for Myanmar-based users (PRD §4.6). This is a lighter footprint than an all-in-one analytics suite like PostHog (session replay, etc.), which would capture more than this product needs by default.
* **Privacy approach when implemented:** assign variants via an anonymous, locally-stored ID (e.g., `localStorage`), never an account-linked identifier; log only aggregate, variant-tagged outcome events to the existing Fastify API/Postgres — no session replay, no cross-device tracking; and default to **excluding the Myanmar-based profile from any experiment** (or making it opt-in), consistent with the surveillance-risk reasoning already in PRD §4.6.

---

## 10. Authentication (Future Phase 3)

**Golden rule: auth must never block practice, and must require virtually zero maintenance.** A learner opening the app to study a lesson or browse the Dhamma Library should never hit a login wall. Auth only comes into play when someone explicitly wants to sync their progress across devices — this is Phase 3 scope (PRD §7), documented now so the approach is decided in advance.

### Principles

* **Anonymous / guest by default.** Every core feature — the literacy lessons, Dhamma Library, class directory — works with zero login, per PRD §4.6. Lesson progress and library bookmarks are stored **locally first** (IndexedDB/localStorage).
* **Seamless migration on sign-in.** When a learner later chooses to create an account (e.g., to keep progress when switching devices), their locally-stored lesson progress and bookmarks migrate into the cloud account automatically — no data loss, no manual re-entry.
* **Passwordless only — no stored passwords.** No password hashing, salt rounds, or "forgot password" email flows to build or maintain.
* **What syncs:** lesson/literacy progress and library bookmarks (this platform doesn't have a "playlists" feature — that's from an earlier, pre-pivot version of the product; keep sync scoped to what's actually in PRD §4.2/§4.3).

### Implementation: Better Auth, self-hosted

**Better Auth**, not a managed third-party service (Supabase Auth, Clerk, Auth0, Azure AD B2C). It runs as a plugin inside the existing Fastify Container App and stores users directly in the existing Postgres — no new vendor, no new service to provision or pay for, and no user identity data leaving Win Metta's own infrastructure. This is the same self-hosted-by-default reasoning already applied to R2 (§6) and GrowthBook (§9): keep user data out of third-party hands, especially given the no-identity-linked-tracking commitment for Myanmar-based users (PRD §4.6).

**Sign-in methods offered — user's free choice, not gated by profile:**

* **Email magic link** — the default, works everywhere including low-connectivity conditions, requires no password.
* **Google, Facebook, and Apple OAuth** — all offered as alternatives. Any user, Myanmar-based or diaspora, chooses whichever they prefer; the app does not decide for them or hide options based on their onboarding profile (§4.1).
* **Avoid SMS OTP** as a method — it carries real security downsides (SIM-swap, carrier interception) industry guidance is actively moving away from, and a phone number is a more sensitive identifier to require than email.

**Backend verification:** public routes (library, class directory, lesson content) require no auth at all. Protected routes (progress/bookmark sync) are verified via Better Auth's own session/verification middleware in Fastify — not a hand-rolled shared-secret JWT check.

### Cross-Platform Note (Future Phase 4 — native apps)

v1 is web-only (§0), so a standard in-browser OAuth redirect is sufficient — no custom protocol handling needed yet. This is filed away for whenever Phase 4 native builds (Electron/Capacitor) actually happen, since it'll matter then: **Google and Apple both block completing OAuth inside an embedded webview** (Google returns `disallowed_useragent`), so a native app must hand off to the system's default browser and catch the redirect via a custom URI scheme:

```
[ Electron / Mobile App ]
        |
        | 1. User taps "Sign in with Google/Apple"
        |    (Generates PKCE code_verifier + challenge)
        v
[ System Default Browser ]
        |
        | 2. User signs in on the provider's own site
        | 3. Redirects to https://api.winmetta.org/auth/callback
        v
[ Custom Protocol Handler ]
        |
        | 4. Redirects OS to: winmetta://auth/callback?code=...
        v
[ Electron / Capacitor App catches the URL, exchanges code for a session ]
```

In Electron this means registering `app.setAsDefaultProtocolClient('winmetta')` and handling the `open-url` event in the main process; in Capacitor, the equivalent is the `@capacitor/app` plugin's `appUrlOpen` listener. Not built in v1 — recorded here so it isn't re-researched from scratch when Phase 4 arrives.
