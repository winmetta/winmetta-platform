# Implementation Plan: Phases 0–2

The first three phases take the project from an empty repo to a public, bilingual site running in staging and production. Each phase has one purpose so a small volunteer team can finish and review it before starting the next.

| Phase | Goal | Deployed? |
| --- | --- | --- |
| **0 — Foundation code** | Repo scaffold: a basic Astro app with all the libraries, tooling and English/Burmese (`en`/`my`) support the site needs. No real pages or content, no deploy. | No (local only) |
| **1 — Five bilingual pages** | Home, About, Privacy, Classes and Dhamma Library (the whole S3 PDF library, tag browsing and fuzzy Burmese search), in English and Burmese, with curated public content. Adds the CI deploy workflow to a single non-public review app. | Review app only (not public) |
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
* **Locale-switch rule:** switching language changes only the locale segment of the URL. Page, search terms, filters, query parameters and fragment stay intact, computed from the URL at the moment the link is activated (not at page load). Any new stateful navigation (Classes, Dhamma Library) must keep this true. The language switcher saves an optional device-local preference with no profile. Explicit locale URLs take precedence; blocked browser storage must not prevent switching or navigation.
* Distinguish **interface locale**, **resource/teaching language** and **timezone**. Switching language does not translate a linked book or recording, or change the default schedule zones.
* Use locale-aware date/number formatting with explicit timezones. Set document `lang` and direction from the registry; retain Pāḷi diacritics; use Unicode Burmese fonts with generous line height. Allow text expansion and prefer logical layout properties.
* For partially translated future content, fall back to the source language with a visible language label; never present a fallback as a translation. A build-time check fails on missing translation keys.
* Each translated page has its own canonical URL and alternate-language links.

### Libraries to choose in Phase 0

Pick and install these now so Phase 1 is content work rather than tooling work: Astro + `@astrojs/react`, Tailwind 4, shadcn/ui, Zod, a Unicode Burmese web font (e.g. Noto Sans Myanmar), a small date/timezone library or `Intl` helpers (e.g. Luxon or date-fns with timezone support), Vitest for unit tests, ESLint, Prettier. Keep dependencies minimal and mainstream. No analytics SDK. Phase 1 additionally installs **MiniSearch** when the library search is built (the Phase 0 filter helper stays a simple substring filter until then).

### Phase 0 checklist

Repository & governance
* [x] Public GitHub repo `winmetta/winmetta-platform` created.
* [x] Add `LICENSE` (MIT License).
* [x] Add `.gitignore` covering `node_modules`, build output, `.env*`, `*.tfvars` (but not `*.tfvars.example`) **before** any such file exists.
* [x] Enable GitHub secret scanning and push protection (repo **Settings → Advanced Security**; free for public repos). Secret scanning detects known credential formats (cloud keys, tokens) in the repo and its history and alerts maintainers. Push protection blocks a `git push` containing a recognized secret before it lands, unless the pusher bypasses it with a stated reason. Both are a backstop; never rely on them instead of keeping secrets out of commits (see [AGENTS.md](../AGENTS.md) §2).
* [x] Add a short `CONTRIBUTING.md` (how to propose content or code changes; contact@winmetta.org).

Tooling
* [x] Commit `.nvmrc`, root `package.json` (with `packageManager`), `turbo.json`, base `tsconfig`, Prettier and ESLint config, and the npm lockfile.
* [x] Add `scripts/setup-local-dev.sh` (`chmod +x`) for repo setup; shared tooling comes from the org `.github` repo (`bootstrap-dev-env.sh`, see its [README](https://github.com/winmetta/.github#developer-setup)).
* [x] `.github/workflows/ci.yml`: lint, typecheck, unit tests and build on every PR (no deploy).

Web app
* [x] Initialize `apps/web` with Astro (`npm create astro@latest`), add React, Tailwind and shadcn/ui.
* [x] Responsive layout shell with touch and keyboard support, supported-browser checks and Unicode Burmese font loading.
* [x] Implement the locale registry, keyed messages, locale-prefixed routes, language switcher, formatting helpers and translation-coverage check.
* [x] Zod content-collection schemas for localized pages, resources, library categories and class schedules (stable IDs, source language, source URLs, verification dates). Keep synthetic fixtures separate from future published content.
* [x] Class schedule schema stores source IANA timezone and local recurrence; helper produces dated Pacific and Myanmar occurrences with daylight-saving and day-rollover unit tests.
* [x] Basic library filter helper with unit tests, including Burmese text. Phase 1 replaces its matching with the MiniSearch index but keeps its normalization tests.

### Phase 0 acceptance

* `npm ci`, `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` and unit tests all pass on a fresh clone via the bootstrap script.
* The smoke page renders in both locales with correct `lang`, working switcher and Burmese font, on mobile and desktop widths; a missing translation key fails the build.
* Nothing in the repo contains real personal data or secrets; no analytics, backend or deploy configuration exists yet.

---

## 3. Phase 1 — Five Bilingual Pages

**Goal:** Home, About, Privacy, Classes and Dhamma Library, complete in English and Burmese, with concise curated public content, the full S3 PDF library indexed with tag browsing and fuzzy Burmese-aware search. Uploading new PDFs and refreshing the index is the Phase 4 pipeline (tech-architecture.md §3, "Library content pipeline"). Phase 1 also adds the CI deploy workflow, deploying to a single non-public review app (default Azure hostname, `noindex`, not linked) so pages can be reviewed in a real environment. The site is not public until Phase 2.

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
| Dhamma Library | `/dhamma-library/` | Unified discovery for Burmese and Dhamma resources: books and PDF files from S3 plus curated app URLs, blog posts and other links, with every PDF in the S3 bucket indexed: folder-style tag browsing and fuzzy search tuned for Burmese (see "Dhamma Library: S3 file index, tags and search"). Other resource types (apps, blog links) stay curated. |

Use shared mobile/desktop navigation for Home, Classes and Dhamma Library; keep About and Privacy easy to reach in the footer. The language switcher is visible and keyboard accessible on both layouts.

### Dhamma Library: S3 file index, tags and search

Phase 1 indexes **every PDF in the existing S3 bucket `dhamma-library`** (audited 2026-10-03: 3,040 objects, about 115 GiB, mostly Burmese books in about 20 numbered folders). All of these files are already public via winmetta.org and the bunny.net CDN, so Phase 1 adds links and search, not new republication. Design, data model and the generator are in [tech-architecture.md](tech-architecture.md) §3 ("Library model and discovery" and "Library content pipeline").

* **Audience and search behavior:** most visitors type Burmese words and do not know a book's title or author, so search is **fuzzy** and surfaces similar books, not only exact matches. Resources live within Dhamma Library; there is no separate top-level Dhamma Resources page.
* **Folders become tags, not categories.** Every path segment of an S3 key is a tag, with the leading number removed (`^[0-9၀-၉]+[။.]\s*`) and zero-width characters dropped. `၁၀။ မြန်မာရှား (၁)/၁။ ဝိနိစ္ဆယများ/…` is tagged `မြန်မာရှား (၁)` and `ဝိနိစ္ဆယများ`; `18. Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ` is tagged `Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ`. Folders with the same name after stripping share a tag. Tags display in their original spelling and match on their normalized form.
* **Folder-style browsing plus search.** The landing page has a search box and a folder (tag) tree; each folder is a pre-rendered static page with breadcrumbs and pagination, usable without JavaScript. Tag filter chips narrow search results. Keep query, tag and page state in the URL so links, back/forward and language switching preserve it (locale-switch rule above). Do not collect search queries as analytics.
* **Normalization (build and query share one function):** NFC; remove U+200B, U+200C and U+200D; lowercase; treat ဥ (U+1025) and ဉ (U+1009) as the same letter; treat Burmese digits ၀–၉ and ASCII digits 0–9 as the same; for Latin text only, fold diacritics (`pali` finds `Pāḷi`). Never strip combining marks on Burmese characters. The digit ၀ and the letter ဝ look alike and are **not** folded (open question for Burmese review). "Roman number" in the requirements means ASCII digits, not Roman numerals.
* **Search engine: MiniSearch**, with the index built at build time and loaded lazily on the library page only. Burmese is segmented into syllables with a deterministic syllable regex (not `Intl.Segmenter`, which differs across browsers) and indexed as 1–3 syllable n-grams, so unspaced and half-typed queries work. Query chunks separated by spaces must all match (AND); matches begin at syllable boundaries (so `က` does not match inside `ကျ`) but may end mid-syllable. Searchable text is the title, parenthetical title note, tags and folder-path names.
* **Results and ranking:** exact and prefix matches first, then a labelled **"Similar books"** group from fuzzy matching. Ranking tiers: exact title, title starts with the query, title contains it, then matches only in tags, folder path or note; ties by folder order, then title. Zero-result searches show fuzzy matches and "more in <tag>" suggestions. Show counts, active filters, a reset control and a helpful empty state.
* **Cards** show title, tags (folder path), size, language and a clear Download action. Identify that downloads are PDFs and show file size.
* **Performance budget** (confirmed in a prototype before building the UI): serialized index at most about 400 KB gzipped, a query in well under 50 ms on a mid-range phone, results rendered in pages and never all 3,000 at once. If Burmese relevance or the budget fails, reduce n-gram size or fall back to a substring-plus-tiers matcher.
* **Not Phase 1:** audio, video and app resources (curated links only), file-body text search, OCR and transcription (Phase 4), and uploading new files (the Phase 4 pipeline). Curated blog-post links may still be added as library resources through the curated `resources` collection; there is no blog feed.

### Content and design boundaries

* Use [winmetta.org](https://winmetta.org/) as a factual reference with a deliberately small selection of high-level content for About, Classes and Home. The library is the exception: it indexes the whole S3 bucket through the generated manifest. Reference pages include [About](https://winmetta.org/about/), [Burmese classes](https://winmetta.org/sayadaw-u-garudhamma-burmese-class/), [Dhamma resources](https://winmetta.org/dhamma-download/) and the [library directory](https://winmetta.org/dhamma-library/). The homepage, resource directory and library were inspected during planning; About could not be fetched and needs verification during content preparation.
* Write concise original navigation and organizational summaries. Preserve teacher names, titles, source attribution and doctrinal wording; do not rewrite teachings. Link out to existing materials rather than importing the whole site. Library titles are derived from S3 filenames and corrected only through the overrides file; never rename S3 objects to fix a title.
* **No bulk blog import, automatic feed or WordPress content migration. Do not reuse winmetta.org's UI design**, layouts, styling, sidebars or navigation hierarchy. Develop a calm, accessible design for mobile and desktop.
* Store source URLs and a last-verified date with curated class/resource metadata. Generated library records carry the S3 key and last-modified time instead. Verify active schedules and destinations before publication; unresolved items may link to the source page without inventing details.
* Production pages use verified public facts and links. Synthetic data is for fixtures and previews only and must not ship as real class listings. Do not import student information or private meeting credentials. Library files are already public; any new media republication, and the JPTS and rare-book scans before the public launch, require the rights check in the PRD.
* Every page and all shared UI have complete English and Burmese translations. Never fabricate translations of teachings.

### Phase 1 checklist

* [ ] Home, About, Privacy, Classes and Dhamma Library built in both locales (10 localized page routes plus the root language entry page), with original layouts.
* [ ] Curated, verified public content: About text and class summaries with Pacific/Myanmar schedules, with source URLs and verification dates.
* [ ] Library manifest generator (`scripts/`): lists the S3 bucket with a read-only AWS profile and writes the committed manifest plus an overrides file; skips `done.txt` and zero-byte objects, reports non-PDF files, detects duplicates by normalized path/name/size (for example the 9 under `၉။ ပေမူများ`), fails on keys that do not round-trip through URL encoding, and sorts output deterministically.
* [ ] `libraryFileSchema` and manifest validation in CI; the build needs no AWS credentials.
* [ ] Shared search normalization (NFC, zero-width removal, ဥ/ဉ, Burmese/ASCII digits, Latin diacritics) and a Myanmar syllable segmentation helper, both unit-tested with real Burmese titles.
* [ ] MiniSearch index built at build time and lazily loaded: Burmese n-gram tokenizer, AND of space-separated chunks, syllable-start matching, tiered ranking, labelled "Similar books" fuzzy group, tag suggestions on empty results.
* [ ] Tag tree and static folder pages with breadcrumbs, pagination, tag filter chips, URL state, counts, reset and empty state.
* [ ] Golden-query suite (Burmese partial words, typos, spaced and unspaced queries, digits, ဥ/ဉ variants) reviewed by a Burmese speaker and run in Vitest against the real manifest; index size and query-time budgets recorded.
* [ ] Replace or remove the Phase 0 smoke page and synthetic fixtures from published content.
* [ ] CI deploy: `.github/workflows/deploy-web.yml` deploys PR previews and `main` to one non-public Azure Static Web App (created by hand under the nonprofit grant; deploy token stored as a GitHub Actions secret). `noindex` on all deployed pages; not linked from winmetta.org.

### Phase 1 acceptance

* All five pages work in both locales; direct loads and internal navigation work without login.
* Both journeys work on mobile and desktop: find a class and its joining information; search/browse the library by folder tag, find a book from a partial or misspelled Burmese phrase, and open its PDF.
* Verify Burmese and English search (partial words, typos, spaces, digit and ဥ/ဉ variants), tag filters, empty results, reset, shareable URLs, back/forward, same-page language switching with filters, duplicate S3 copies shown once, and every library link returning the PDF.
* Validate translation coverage, blocked-storage behavior, mobile text wrapping, keyboard navigation, document language metadata and source-link validity.
* Verify Pacific daylight-saving transitions and Myanmar date/day rollover independently of interface language. No analytics, blog feed or copied WordPress design.

---

## 4. Phase 2 — Infrastructure & Deployment

**Goal:** deploy the Phase 1 site to **staging** and **production** with infrastructure defined as code. Details in [tech-architecture.md](tech-architecture.md) §6–§8.

* [ ] Terraform in `infra/terraform/` (Static Web Apps, S3 buckets and IAM, Bunny pull zones, Cloudflare DNS records), remote state in Terraform Cloud; `.tfvars.example` only. `terraform plan` on PRs touching `infra/`; `terraform apply` is a manual maintainer action. Import or replace the hand-made Phase 1 review app.
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

## 6. Reference: macOS Setup Script

Shared developer tooling (Homebrew, git, gh, shellcheck, shfmt, nvm, editor, AI CLIs) is installed by `bootstrap-dev-env.sh` in the org [`.github` repo](https://github.com/winmetta/.github#developer-setup). This repo's own `scripts/setup-local-dev.sh` then installs Node from `.nvmrc`, the pinned npm, locked dependencies and the Playwright browser.

---

## 7. Agent & Contributor Docs

[AGENTS.md](../AGENTS.md) is the single source of truth for conventions used by contributors and AI coding agents. It is not duplicated here — read that file rather than a copy in this plan. `CLAUDE.md` is a symlink to it (`ln -s AGENTS.md CLAUDE.md`).
