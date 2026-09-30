# Implementation Plan: Phases 0–2

The first three phases take the project from an empty repo to a public, bilingual site running in staging and production. Each phase has one purpose so a small volunteer team can finish and review it before starting the next.

| Phase | Goal | Deployed? |
| --- | --- | --- |
| **0 — Foundation code** | Repo scaffold: a basic Astro app with all the libraries, tooling and English/Burmese (`en`/`my`) support the site needs. No real pages or content, no deploy. | No (local only) |
| **1 — Five bilingual pages** | Home, About, Privacy, Classes and Dhamma Library (with basic search), in English and Burmese, with curated public content. Adds the CI deploy workflow to a single non-public review app. | Review app only (not public) |
| **2 — Infrastructure & deployment** | Terraform, domains, Azure, AWS S3 + bunny.net media delivery, Cloudflare DNS, and staging and production environments with promotion. | Yes (public) |

Later phases (LLB lessons, library expansion, accounts, native apps) are in [prd.md](prd.md) §7. Scope per [prd.md](prd.md) (§4.7, §7) and [tech-architecture.md](tech-architecture.md) (§0): one static Astro web app designed for mobile and desktop — no backend, no database, no desktop/mobile apps.

## 1. Baseline Toolchain

Public GitHub repo [`winmetta/winmetta-platform`](https://github.com/winmetta/winmetta-platform) under the MIT License, native macOS development (no Docker, no database).

| Tool | Version (as of September 2026 — verify before kickoff) | Notes |
| --- | --- | --- |
| Node.js | 24.x (Active LTS) | Node 22 is Maintenance LTS only (EOL April 2027). |
| npm | 11.x | Bundled with Node 24. |
| TypeScript | ^6.0 | TS 7 is beta — don't build on it yet. |
| Turborepo | ^2.11 | |
| Astro | ^7.3 | Static-first pages, React islands. |
| React | ^19.3 | Islands only, not the whole app shell. |
| Tailwind CSS | ^4.3 | |

PostgreSQL and Fastify are **not** part of these phases (see [tech-architecture.md](tech-architecture.md) §10).

---

## 2. Phase 0 — Foundation Code

**Goal:** a basic app that builds, lints, type-checks and runs locally, with every library the later phases need already chosen and wired up, and full English/Burmese support in place. It contains no real pages or content and is not deployed.

### Scope

* Repo governance, tooling and dev environment (checklist below; config in §5–§7).
* `apps/web` scaffolded with Astro, React, Tailwind, shadcn/ui, and Zod content-collection schemas.
* Internationalization machinery (below).
* Responsive layout shell (header, footer, language switcher) for mobile and desktop with touch and keyboard support and Unicode Burmese font loading.
* Helpers and schemas that Phase 1 needs: library resource schema, class-schedule schema with IANA timezone handling, and a basic library filter helper.
* Basic CI: lint, typecheck and build on every PR. **No deploy.**
* One throwaway smoke page per locale using clearly synthetic fixtures, to prove routing, translations and layout work. Phase 1 replaces or removes it.

### Internationalization foundation

* Support **English (`en`) and Burmese (`my`)**. Use a central locale registry with BCP 47 language tags, display names, text direction and formatting defaults; new locales must be addable without redesigning page components.
* Generate locale-prefixed routes (e.g. `/en/classes/`, `/my/classes/`) from stable page identifiers via a shared route helper. The root `/` is a lightweight language choice linking to both homepages; deep links render their URL's language with no automatic geographic redirects.
* Keep UI messages in keyed locale dictionaries and page text in localized content records, separate from layout code. Share stable class/resource IDs, URLs and schedule data across translations. Avoid hardcoded user-facing strings, binary language conditionals and sentence concatenation.
* The language switcher preserves the current page and saves an optional device-local preference with no profile. Explicit locale URLs take precedence; blocked browser storage must not prevent switching or navigation.
* Distinguish **interface locale**, **resource/teaching language** and **timezone**. Switching language does not translate a linked book or recording, or change the default schedule zones.
* Use locale-aware date/number formatting with explicit timezones. Set document `lang` and direction from the registry; retain Pāḷi diacritics; use Unicode Burmese fonts with generous line height. Allow text expansion and prefer logical layout properties.
* For partially translated future content, fall back to the source language with a visible language label; never present a fallback as a translation. A build-time check fails on missing translation keys.
* Each translated page has its own canonical URL and alternate-language links.

### Libraries to choose in Phase 0

Pick and install these now so Phase 1 is content work rather than tooling work: Astro + `@astrojs/react`, Tailwind 4, shadcn/ui, Zod, a Unicode Burmese web font (e.g. Noto Sans Myanmar), a small date/timezone library or `Intl` helpers (e.g. Luxon or date-fns with timezone support), Vitest for unit tests, ESLint, Prettier. Keep dependencies minimal and mainstream. No analytics SDK.

### Phase 0 checklist

Repository & governance
* [x] Public GitHub repo `winmetta/winmetta-platform` created.
* [x] Add `LICENSE` (MIT License).
* [ ] Add `.gitignore` covering `node_modules`, build output, `.env*`, `*.tfvars` (but not `*.tfvars.example`) **before** any such file exists.
* [ ] Enable GitHub secret scanning and push protection.
* [ ] Add a short `CONTRIBUTING.md` (how to propose content or code changes; contact@winmetta.org).

Tooling
* [ ] Commit `.nvmrc`, root `package.json` (with `packageManager`), `turbo.json`, base `tsconfig`, Prettier and ESLint config, and the npm lockfile.
* [ ] Add `scripts/bootstrap-macos.sh` (`chmod +x`).
* [ ] `.github/workflows/ci.yml`: lint, typecheck, unit tests and build on every PR (no deploy).

Web app
* [ ] Initialize `apps/web` with Astro (`npm create astro@latest`), add React, Tailwind and shadcn/ui.
* [ ] Responsive layout shell with touch and keyboard support, supported-browser checks and Unicode Burmese font loading.
* [ ] Implement the locale registry, keyed messages, locale-prefixed routes, language switcher, formatting helpers and translation-coverage check.
* [ ] Zod content-collection schemas for localized pages, resources, library categories and class schedules (stable IDs, source language, source URLs, verification dates). Keep synthetic fixtures separate from future published content.
* [ ] Class schedule schema stores source IANA timezone and local recurrence; helper produces dated Pacific and Myanmar occurrences with daylight-saving and day-rollover unit tests.
* [ ] Basic library filter helper (see Phase 1 search rules) with unit tests, including Burmese text.

### Phase 0 acceptance

* `npm ci`, `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` and unit tests all pass on a fresh clone via the bootstrap script.
* The smoke page renders in both locales with correct `lang`, working switcher and Burmese font, on mobile and desktop widths; a missing translation key fails the build.
* Nothing in the repo contains real personal data or secrets; no analytics, backend or deploy configuration exists yet.

---

## 3. Phase 1 — Five Bilingual Pages

**Goal:** Home, About, Privacy, Classes and Dhamma Library, complete in English and Burmese, with concise curated public content and basic library search. Phase 1 also adds the CI deploy workflow, deploying to a single non-public review app (default Azure hostname, `noindex`, not linked) so pages can be reviewed in a real environment. The site is not public until Phase 2.

### Two primary user groups

1. **Students attending online Zoom classes:** quickly find their class, the schedule, joining information and relevant study resources.
2. **Anonymous independent learners worldwide:** discover Burmese-language learning resources and Dhamma (Buddhist teachings), with no assumed class enrollment, nationality, heritage or prior familiarity.

Both groups can use every page without an account, onboarding questionnaire or profile. **Classes** and **Dhamma Library** are the two main page groups: Classes primarily supports online students, the library primarily supports independent discovery. Class pages link to relevant library entries, and both groups remain open to everyone. Home offers clear paths to both; neither geography nor interface language decides which path a learner may take.

### Five pages

Routes are relative to the locale prefix (`/en/` or `/my/`).

| Page | Route | Content and purpose |
| --- | --- | --- |
| Home | `/` | Short introduction to Win Metta and the platform, with clear links to Classes and Dhamma Library for both user groups. |
| About | `/about/` | Concise mission, Theravāda teaching context, learning activities and public contact information. Link to the main organization site for further detail. |
| Privacy | `/privacy/` | Plain-language explanation specific to the platform as implemented: local language preferences and any other browser storage actually used, deferred product analytics, hosting/CDN operational processing, external links and a contact for questions. Do not copy WordPress policy text or claim that no provider processes visitor data. Describe lesson progress storage only when implemented. |
| Classes | `/classes/` | Brief introduction to online classes and a small verified set of active class summaries: course name, teacher, teaching language, Pacific/Myanmar dated schedule, and public joining/resource links where confirmed. Identify paused classes if included; do not infer missing times or reuse struck-through meeting details. |
| Dhamma Library | `/dhamma-library/` | Unified discovery for Burmese and Dhamma resources: books, PDF files, mobile/desktop app URLs, audio, video, images, slides, blog posts and other curated links, with basic search and category/content-type filters over a small verified collection. |

Use shared mobile/desktop navigation for Home, Classes and Dhamma Library; keep About and Privacy easy to reach in the footer. The language switcher is visible and keyboard accessible on both layouts.

### Dhamma Library discovery (basic)

* Resources live within Dhamma Library; there is no separate top-level Dhamma Resources page. The landing page has a search field, category navigation and content-type filters on mobile and desktop, and the curated list is browsable without typing.
* Start with categories such as Burmese learning, Dhamma study, meditation and Pāḷi/Tipiṭaka, refined against the curated content. Categories describe subjects; content types describe the resource. A resource may belong to multiple categories.
* Support books, PDFs, apps, audio, video, images, slides and blog posts. Keep file format separate from content type: a book or slide deck may be a PDF. One resource may have several access links/formats; app entries label mobile/desktop platforms. Avoid duplicate cards per format of the same work.
* **Search is deliberately basic:** a case-insensitive substring match over title, short description, author/teacher and tags, using whatever English and Burmese metadata exists, regardless of UI locale. Substring matching works for Burmese without word segmentation. No ranking, fuzzy matching, stemming or full-text search.
* Combine the search box with category, content-type and resource-language filters. Show result counts, active filters, a reset control and a helpful empty state. Keep query/filter state in the URL so links, back/forward and language switching preserve it. Do not collect search queries as analytics.
* Cards show title, short description, author/teacher when known, content type, resource language, and a clear action (Read, Download, Listen, Watch, Open app/site). Identify external destinations and show file size when known.
* Start with a small verified set spanning the available types; don't invent content to fill gaps. Curated blog-post links are allowed as library resources; a standalone publishing system or automatic blog feed is out of scope.
* **Deferred to Phase 4:** full-featured search (ranking, fuzzy matching, a dedicated search library), full PDF/book text, OCR, audio transcription and external-site crawling.

### Content and design boundaries

* Use [winmetta.org](https://winmetta.org/) as a factual reference with a deliberately small selection of high-level content. Reference pages include [About](https://winmetta.org/about/), [Burmese classes](https://winmetta.org/sayadaw-u-garudhamma-burmese-class/), [Dhamma resources](https://winmetta.org/dhamma-download/) and the [library directory](https://winmetta.org/dhamma-library/). The homepage, resource directory and library were inspected during planning; About could not be fetched and needs verification during content preparation.
* Write concise original navigation and organizational summaries. Preserve teacher names, titles, source attribution and doctrinal wording; do not rewrite teachings. Link out to existing materials rather than importing the whole site.
* **No bulk blog import, automatic feed or WordPress content migration. Do not reuse winmetta.org's UI design**, layouts, styling, sidebars or navigation hierarchy. Develop a calm, accessible design for mobile and desktop.
* Store source URLs and a last-verified date with curated class/resource metadata. Verify active schedules and destinations before publication; unresolved items may link to the source page without inventing details.
* Production pages use verified public facts and links. Synthetic data is for fixtures and previews only and must not ship as real class listings. Do not import student information or private meeting credentials. Any later media republication requires the rights check in the PRD.
* Every page and all shared UI have complete English and Burmese translations. Never fabricate translations of teachings.

### Phase 1 checklist

* [ ] Home, About, Privacy, Classes and Dhamma Library built in both locales (10 localized page routes plus the root language entry page), with original layouts.
* [ ] Curated, verified public content: About text, class summaries with Pacific/Myanmar schedules, and a small library collection with source URLs and verification dates.
* [ ] Library search box, category/content-type/language filters, URL state, counts, reset and empty state (basic substring search).
* [ ] Replace or remove the Phase 0 smoke page and synthetic fixtures from published content.
* [ ] CI deploy: `.github/workflows/deploy-web.yml` deploys PR previews and `main` to one non-public Azure Static Web App (created by hand under the nonprofit grant; deploy token stored as a GitHub Actions secret). `noindex` on all deployed pages; not linked from winmetta.org.

### Phase 1 acceptance

* All five pages work in both locales; direct loads and internal navigation work without login.
* Both journeys work on mobile and desktop: find a class and its joining information; search/browse the library by category and content type and open a resource.
* Verify English and Burmese search, combined filters, empty results, reset, shareable URLs, back/forward, same-page language switching with filters, and book/slide PDFs shown without duplicate cards.
* Validate translation coverage, blocked-storage behavior, mobile text wrapping, keyboard navigation, document language metadata and source-link validity.
* Verify Pacific daylight-saving transitions and Myanmar date/day rollover independently of interface language. No analytics, blog feed or copied WordPress design.

---

## 4. Phase 2 — Infrastructure & Deployment

**Goal:** deploy the Phase 1 site to **staging** and **production** with infrastructure defined as code. Details in [tech-architecture.md](tech-architecture.md) §6–§8.

* [ ] Terraform in `infra/` (Static Web Apps, S3 buckets and IAM, Bunny pull zones, Cloudflare DNS records), remote state in Terraform Cloud; `.tfvars.example` only. `terraform plan` on PRs touching `infra/`; `terraform apply` is a manual maintainer action. Import or replace the hand-made Phase 1 review app.
* [ ] Azure: subscription/resource group under the nonprofit grant, a scoped Service Principal for CI (secret stored in GitHub Actions), and two Azure Static Web Apps — production and staging.
* [ ] Domains and DNS (Cloudflare, DNS-only records): `app.winmetta.org` (production) and `staging.app.winmetta.org` (staging) via CNAME; `winmetta.org` itself and existing WordPress records are unchanged.
* [ ] Media: private AWS S3 buckets for production and staging (separate, public access blocked), served through bunny.net pull zones on `cdn.app.winmetta.org` (proposed) and a staging hostname, with unproxied Cloudflare CNAME records. Bunny reads via S3 origin authentication using a read-only IAM user; verify per tech-architecture.md §6. Verify public fetches, cache hits, CORS, MIME types and audio/video seeking.
* [ ] CI/CD promotion: extend `deploy-web.yml` so `main` deploys automatically to staging and a deliberate step (tag or manual approval) promotes to production.
* [ ] `noindex` and access restriction on staging and PR previews.
* [ ] Smoke-test both environments end to end, document the rollback procedure, and record the runbook for editing content and redeploying.

Out of scope for Phases 0–2 (future work): interactive LLB lessons, bulk library ingestion, full-featured/full-text/OCR/transcript search, unified class archive, additional locales beyond English/Burmese, product analytics/metric collection, profile timezone preferences, backend API, database, accounts, offline/PWA, `apps/desktop`, `apps/mobile`. Excluded entirely: standalone blog publishing/automatic feeds, copying the existing site UI, bulk website migration.

---

## 5. Reference: Monorepo Configuration

### Root `package.json`

```json
{
  "name": "winmetta-platform",
  "private": true,
  "packageManager": "npm@11.20.0",
  "license": "MIT",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.11.0",
    "prettier": "^3.9.0",
    "typescript": "^6.0.0"
  },
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=11.0.0"
  }
}
```

Pin npm consistently in local setup and CI using the root `packageManager` declaration; `engines.npm` alone is not the Turborepo package-manager declaration. The example uses npm 11.20.0; re-verify at kickoff. Commit the generated lockfile and use `npm ci` for repeat installs.

### `.nvmrc`

```
24
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {}
  }
}
```

---

## 6. Reference: macOS Setup Script (`scripts/bootstrap-macos.sh`)

Installs Homebrew, shell tooling and Node (via nvm), then project dependencies. Run it from the repo root.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Win Metta Platform: macOS native development bootstrap
# Installs: Homebrew, shellcheck, shfmt, Node via nvm, npm dependencies.
# Run from the repository root.
# ==============================================================================

if [ ! -f .nvmrc ]; then
  echo "Run this script from the repository root (where .nvmrc lives)." >&2
  exit 1
fi

echo "==> [1/5] Checking for Xcode Command Line Tools..."
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Installing Xcode Command Line Tools..."
  xcode-select --install
  echo "Complete the GUI prompt, then re-run this script."
  exit 1
fi

echo "==> [2/5] Checking for Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  echo "Homebrew already installed. Updating..."
  brew update
fi

echo "==> [3/5] Installing shell tooling (shellcheck, shfmt, git, curl)..."
brew install shellcheck shfmt git curl

echo "==> [4/5] Ensuring nvm and Node.js are installed..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

NODE_VERSION="$(cat .nvmrc)"
echo "Installing Node.js $NODE_VERSION via nvm..."
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

echo "==> [5/5] Installing npm dependencies..."
NPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
npm install --global "npm@$NPM_VERSION"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "=========================================================="
echo " Win Metta development environment is ready."
echo " Run 'npm run dev' to start the local dev server."
echo "=========================================================="
```

Optional, personal choices (not part of the script): install an AI coding tool of your choice; `AGENTS.md` and the `CLAUDE.md` symlink are already committed in the repo.

---

## 7. Agent & Contributor Docs

[AGENTS.md](../AGENTS.md) is the single source of truth for conventions used by contributors and AI coding agents. It is not duplicated here — read that file rather than a copy in this plan. `CLAUDE.md` is a symlink to it (`ln -s AGENTS.md CLAUDE.md`).
