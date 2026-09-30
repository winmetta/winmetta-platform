# Technical Architecture

**Status:** Phase 0 and Phase 1 are specified in detail. Everything under "Future" is a *tentative direction* recorded so ideas aren't lost — it is **not** a source of truth and will be redesigned when that phase is actually planned.

**Guiding principle:** pick popular, well-documented tools with large communities, easy learning curves for volunteers, and good long-term support. Prefer free programs offered to nonprofits, but paying for tooling is fine when it saves volunteer time or reduces risk — donations may fund tech development and maintenance (see [prd.md](prd.md) §5).

---

## 0. Scope: v1 Is a Static Web App

Per [prd.md](prd.md) §4.7 and §7, v1 is **one mobile-responsive web app built with Astro** (static-first, React islands for interactive pieces). Most content — LLB curriculum, Dhamma Library metadata, class directory — is static and lives in the repo as content collections. That means **no backend server and no database in Phase 0/1**: fewer moving parts for a volunteer team to run, cheaper, and easier to move.

A backend (Fastify + PostgreSQL), accounts, offline support and native apps are all documented as [future work](#10-future-directions-tentative), added only when a real need appears.

---

## 1. Overview

```
   Visitors (browser, mobile-responsive)
        |
        v
+----------------------------------+        +------------------------+
| Astro static site                |        | Cloudflare R2          |
| app.winmetta.org                 |------->| audio, video, PDF,     |
| (Azure Static Web Apps)          | media  | images (S3-compatible) |
|  - pre-rendered pages            | URLs   +------------------------+
|  - React islands (lesson practice)|
|  - progress stored in IndexedDB  |        +------------------------+
|                                  |------->| Anonymous analytics    |
+----------------------------------+ events | (Plausible, cookieless)|
                                            +------------------------+

Future (tentative, see §10): Fastify API + PostgreSQL on Azure Container Apps,
accounts (Google sign-in, email link via SendGrid), offline/PWA, native shells.
```

Core content must always work with **no account and no login** (PRD §4.6).

---

## 2. Technology Choices (v1)

Versions are a baseline as of September 2026 — re-check before Phase 0 kickoff.

| Layer | Selection | Version baseline | Why |
| --- | --- | --- | --- |
| Runtime | **Node.js** | 24.x (Active LTS) | Longest support runway. Node 22 is Maintenance LTS (EOL April 2027). |
| Package manager | **npm** | 11.x (bundled) | No extra tool for contributors to learn. |
| Monorepo | **Turborepo + npm workspaces** | ^2.11 | Lightweight, standard Node tooling. |
| Language | **TypeScript** (strict) | ^6.0 | TS 7 (native rewrite) is in beta — track it, don't build on it yet. |
| Web app | **Astro** + **React** islands | Astro ^7.3, React ^19.3 | Ships almost no JS by default; pre-renders content for SEO and low-bandwidth/older devices; React only where interactivity is needed. |
| Content & schemas | **Astro content collections** with **Zod** | — | Zod is Astro's built-in schema layer and the most popular TypeScript validator. Content lives in the repo as Markdown/JSON. |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Tailwind ^4.3 | Widely used; components are copied into the repo, so no dependency abandonment risk. |
| Static hosting | **Azure Static Web Apps** | Free tier; Standard if needed | Free SSL, CDN, custom domain, PR preview environments. Covered by the Azure for Nonprofits grant. |
| Media | **Cloudflare R2** | — | S3-compatible, $0 egress. Kept off Azure deliberately (§6). |
| Analytics | **Plausible** (hosted) | — | Cookieless, no personal data, custom events; see §4.4. Swappable. |
| Infra as code | **Terraform** | — | Portable across clouds; see §8. |
| CI/CD | **GitHub Actions** | — | Free for public repos. |

---

## 3. Monorepo Layout & Content Model

```
winmetta-platform/
├── .github/workflows/
│   ├── ci.yml                 # lint, typecheck, build on every PR
│   └── deploy-web.yml         # Azure Static Web Apps deploy (prod + PR previews)
├── apps/
│   └── web/                   # Astro app (the only v1 app)
│       ├── src/
│       │   ├── pages/         # file-based routes (library, classes, curricula, about)
│       │   ├── components/    # Astro components + React islands
│       │   └── content/       # content collections: curricula, library index, class schedule
│       ├── astro.config.mjs
│       └── package.json
├── packages/                  # created when first needed, not up front
│   ├── tsconfig/              # shared base tsconfig (Phase 0)
│   ├── ui/                    # shared components, once a second consumer exists
│   └── shared-types/          # shared Zod schemas, once code is shared
├── infra/                     # Terraform (see §8)
│   ├── modules/platform/
│   └── environments/production/
├── scripts/
│   └── bootstrap-macos.sh
├── .nvmrc                     # 24
├── AGENTS.md / CLAUDE.md -> AGENTS.md
├── LICENSE                    # MIT
├── package.json
└── turbo.json
```

Start simple: with a single app, keep shared code inside `apps/web` and extract a package only when a second consumer needs it.

### Curriculum naming

Organize content by the **actual class name Win Metta already uses**, never by generic subject (e.g. not a bare "Pāḷi" bucket). Every curriculum gets a short `curriculum` code, and `teacher` is always a separate field — a curriculum doesn't belong to its current teacher personally, since teachers can be joined or succeeded.

The word "lesson" is fine as a generic content-unit term in code (e.g. `lesson.ts`), but always qualify it with its curriculum code in data, URLs and UI (e.g. `llb/grade-1/…`) so content from different classes stays unambiguous.

| `curriculum` code | Class name (as taught today) | Current teacher |
| --- | --- | --- |
| `llb` | Let's Learn Burmese | Ven. U Garudhamma |
| `pgtp` | Pāḷi Saddā & Tipiṭaka Pāḷi (ပါဠိသဒ္ဒါ နှင့် တိပိဋကပါဠိ သင်တန်း) | Ven. U Garudhamma |
| *(unassigned)* | Sutta Piṭaka Study (မူရင်းသုတ္တန်ပိဋကတ်ပါဠိတော်ကို လေ့လာခြင်း သင်တန်း) | Ven. Kelāsa |

`llb` and `pgtp` share a teacher today but remain separate curricula. Add any new class to this table with its own code before digitizing its content.

---

## 4. Flows (v1)

### 4.1. Content delivery

Pages (library, class directory, curriculum pages) are pre-rendered at build time from repo content. Audio/PDF/images are referenced by R2 URLs and fetched directly by the browser. No API call is needed to read or learn anything.

### 4.2. Content refresh

Static generation means content changes appear after a rebuild:

```
Content change merged to main (new class time, new library entry, new LLB content)
   -> GitHub Actions builds the Astro site
   -> Deployed to Azure Static Web Apps
```

Volunteers edit Markdown/JSON in the repo via pull request. If a non-technical editing workflow becomes necessary, evaluate a Git-based CMS later. A scheduled rebuild can be added if content needs to change without a merge.

### 4.3. Learner progress (local)

LLB practice progress, spaced-repetition state, and library bookmarks are stored in the browser with **IndexedDB** (via a small wrapper library such as `idb`). No account needed, nothing leaves the device. Cross-device sync is a future feature (§10).

### 4.4. Anonymous analytics

We want to understand what learners do (which curricula and pages are used, where practice sessions end, which library texts are read) so success metrics in [prd.md](prd.md) §6 are measurable — without tracking individuals.

* Collect events for **all users** (no opt-out by segment), but **anonymized**: no cookies, no user IDs, no IP storage, no cross-session or cross-device identity.
* Use a cookieless analytics service with custom events (Plausible to start; swappable, e.g. self-hosted Umami, later). Events are aggregate counts tagged with things like `curriculum`, `lesson id`, `event type`.
* Do not put personal data (names, emails) in event properties.
* Metrics that need per-learner continuity (e.g. return-to-learn) are approximated from aggregate/anonymous data, or derived from opt-in accounts later.

---

## 5. Burmese Text Encoding: Unicode-Only (v1)

All Burmese-script content — UI strings, digitized curriculum, library metadata — uses **Unicode (Myanmar block, U+1000–U+109F)**. **Zawgyi**, the legacy non-Unicode encoding still found on older devices, older PDFs and much pre-2019 Myanmar web content, is **out of scope for v1**.

Zawgyi and Unicode look similar but are byte-incompatible; mixing them garbles text. If Phase 2 library digitization or user-contributed content turns out to include Zawgyi, add a detection/conversion step (e.g. Google's open-source `myanmar-tools`). Noted so it isn't a surprise mid-migration. Ship a Unicode Burmese web font (e.g. Noto Sans Myanmar) so pages render consistently on older devices.

---

## 6. Hosting & Domains

Win Metta has an Azure for Nonprofits grant ($2,000/year). It covers only first-party Azure services, doesn't roll over, and must be reactivated annually — a lapse year should be planned for, not a surprise.

**Cost policy:** prefer free tiers and nonprofit programs, but spending money on the tech stack is acceptable. Donation funds may pay for development and maintenance.

`winmetta.org` (WordPress) is unchanged by this repo. The platform lives on a subdomain:

| Host | Points to | Purpose |
| --- | --- | --- |
| `winmetta.org` (+ `www`) | Existing WordPress hosting | Blog/news, About, existing pages — untouched. |
| `app.winmetta.org` | Azure Static Web Apps | This platform's frontend. `app.` chosen as the most understandable label for less tech-fluent users. |

Add the custom domain via CNAME. WordPress navigation can link to `app.winmetta.org`, and the app can link back for blog/news.

| Component | Where | Why |
| --- | --- | --- |
| Astro build output | **Azure Static Web Apps** | SSL, CDN, custom domain, PR previews. Free tier caps at 100 GB/month bandwidth; heavy media goes to R2, not this path. |
| Audio, video, PDF, images | **Cloudflare R2** (not Azure Blob) | $0 egress vs. Azure's ~$0.087/GB beyond a shared free allowance; media is the cost most likely to grow as the mission succeeds. S3-compatible, so it moves to S3/Backblaze/MinIO without code changes. |

**Portability:** avoid Azure-specific SDKs in application code; use an S3-compatible client for media; keep static output host-agnostic. Moving hosts later is a DNS change plus a new deploy target.

---

## 7. Environments & CI/CD

Deliberately small, for a volunteer team.

| Environment | Where | Purpose |
| --- | --- | --- |
| **Production** | `app.winmetta.org` | Live site. |
| **PR previews** | Azure Static Web Apps' auto-generated ephemeral URL | Per-pull-request check; torn down when the PR closes. |
| **Local** | `npm run dev` | Development. No Docker, no database. |

A separate long-lived staging environment isn't needed while the site is static — PR previews serve that purpose. Preview URLs should not be indexed: send `noindex` on non-production environments. Restricting preview access to maintainers may require the Static Web Apps **Standard** plan (paid, ~$9/month) — acceptable if unfinished content needs to be hidden; verify current plan features before relying on it.

**Flow:**

1. **PR opened** → `ci.yml` runs lint, typecheck, build → Static Web Apps deploys a preview.
2. **Merge to `main`** → deploy to production (`deploy-web.yml`). For a static content site this is low-risk and easy to roll back by reverting the commit. Add a manual approval gate later if it becomes worthwhile.

Enable GitHub secret scanning and push protection on the repo (free for public repos).

---

## 8. Infrastructure Provisioning

**Terraform**, not manual Portal clicks — the same tool works across Azure, Cloudflare and other clouds, so a future host move changes provider blocks, not workflow. Terraform has a learning curve; for Phase 0 the footprint is small (Static Web App, custom domain, R2 bucket), so a first pass can be done by hand and codified right after. Confirm the team is comfortable before committing to it.

```
infra/
├── modules/platform/         # Static Web App, R2 bucket, DNS records
└── environments/production/  # Calls the module
```

* **State:** Terraform Cloud free tier (remote state and locking, nothing in git).
* **Public repo rule:** commit only `.tfvars.example` with placeholders; real `.tfvars`, subscription/tenant IDs and connection strings stay untracked.
* `terraform plan` runs on PRs touching `infra/`; `terraform apply` is a manual maintainer action, never automatic.
* **CI auth:** an Azure Service Principal scoped to the needed resource group only, stored as a GitHub Actions secret.

---

## 9. Experimentation (Future)

Not needed for v1. If a concrete learning-outcome question arises (e.g. does one practice-pacing approach improve return-to-learn?), evaluate lightweight options at that time (self-hosted GrowthBook is one candidate). Experiments should measure learning outcomes, not engagement — see the Calm by Default principle in [prd.md](prd.md) §3 — and should use the same anonymous approach as §4.4.

---

## 10. Future Directions (Tentative)

*Everything here is a starting idea, not a design. Revisit and rewrite when the relevant phase begins.*

### Backend & database (likely Phase 3)

When a feature needs server state (accounts, progress sync, dynamic content), add:

* **Fastify + TypeScript** API in `apps/server`, run as a plain Docker container on **Azure Container Apps** (Consumption plan scales to zero).
* **PostgreSQL 18** on Azure Database for PostgreSQL – Flexible Server (Burstable). Vanilla Postgres only, so it stays portable. Note this is a real fixed cost; stopped Flexible Servers restart automatically after ~7 days.
* `api.winmetta.org` as a sibling subdomain; a staging environment with its own separate database at that point.
* Local dev against a native Postgres at `localhost:5432/winmetta_dev`.

### Accounts & progress sync (likely Phase 3)

* Core content stays fully usable with no login; accounts are optional and only for syncing progress/bookmarks across devices. Existing IndexedDB data migrates into the account on first sign-in.
* Passwordless. Candidate implementation: **Better Auth** inside the Fastify app, storing users in the same Postgres.
* Sign-in methods: **Google** first, plus **email magic link sent via SendGrid**. Facebook and Apple can be added later if learners ask. Avoid SMS OTP.
* Collect the minimum data needed and state its purpose clearly.

### Offline support

Offline use (downloaded curriculum content, audio and library files) is desirable but not a v1 requirement. When taken up, a PWA (service worker + cache) is the lowest-friction starting point. Don't design v1 pages around it beyond keeping assets cacheable.

### Native apps (Phase 4)

Electron desktop and Capacitor mobile builds may wrap the web app later. Notes for then: Google and Apple block OAuth in embedded webviews, so native apps must hand sign-in off to the system browser and catch the redirect via a custom URI scheme (`app.setAsDefaultProtocolClient` in Electron; `@capacitor/app` `appUrlOpen` in Capacitor). Desktop auto-update can use `electron-builder` + `electron-updater` against GitHub Releases.
