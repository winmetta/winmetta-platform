# Technical Architecture

**Status:** Phases 0–2 (foundation code, five bilingual pages, infrastructure & deployment) are specified in detail in [implementation-plan.md](implementation-plan.md). Everything under "Future" is a *tentative direction* recorded so ideas aren't lost — it is **not** a source of truth and will be redesigned when that phase is actually planned.

**Guiding principle:** pick popular, well-documented tools with large communities, easy learning curves for volunteers, and good long-term support. Prefer free programs offered to nonprofits, but paying for tooling is fine when it saves volunteer time or reduces risk — donations may fund tech development and maintenance (see [prd.md](prd.md) §5).

---

## 0. Scope: v1 Is a Static Web App

Per [prd.md](prd.md) §4.7 and §7, v1 is **one responsive web app designed for mobile and desktop, built with Astro** (static-first, React islands for interactive pieces). Most content — LLB curriculum, Dhamma Library metadata, class directory — is static and lives in the repo as content collections. That means **no backend server and no database in Phases 0–2**: fewer moving parts for a volunteer team to run, cheaper, and easier to move.

A backend (Fastify + PostgreSQL), accounts, offline support and native apps are all documented as [future work](#10-future-directions-tentative), added only when a real need appears.

---

## 1. Overview

```
   Visitors (mobile and desktop browsers)
        |
        v
+-----------------------------------+
| Astro static site                 |
| app.winmetta.org                  |
| (Azure Static Web Apps)           |
|  - pre-rendered pages             |
|  - React islands (practice)       |
|  - progress stored in IndexedDB   |
+-----------------------------------+
        | Browser fetches public media URLs
        v
bunny.net CDN (proposed: cdn.app.winmetta.org, DNS on Cloudflare)
        | Origin fetch on cache miss
        v
AWS S3 bucket (audio, video, PDF, images)

Future (tentative, see §10): Fastify API + PostgreSQL on Azure Container Apps,
accounts (Google sign-in, email link via SendGrid), offline/PWA, native shells.
```

Core content must always work with **no account and no login** (PRD §4.6).

---

## 2. Technology Choices (v1)

Versions are a baseline as of September 2026 — re-check before kickoff.

| Layer | Selection | Version baseline | Why |
| --- | --- | --- | --- |
| Runtime | **Node.js** | 24.x (Active LTS) | Longest support runway. Node 22 is Maintenance LTS (EOL April 2027). |
| Package manager | **npm** | 11.x (bundled) | No extra tool for contributors to learn. |
| Monorepo | **Turborepo + npm workspaces** | ^2.11 | Lightweight, standard Node tooling. |
| Language | **TypeScript** (strict) | ^6.0 | TS 7 (native rewrite) is in beta — track it, don't build on it yet. |
| Web app | **Astro** + **React** islands | Astro ^7.3, React ^19.3 | Ships almost no JS by default; pre-renders content for SEO and low-bandwidth connections and supported devices; React only where interactivity is needed. |
| Content & schemas | **Astro content collections** with **Zod** | — | Zod is Astro's built-in schema layer and the most popular TypeScript validator. Content lives in the repo as Markdown/JSON. |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Tailwind ^4.3 | Widely used; components are copied into the repo, so no dependency abandonment risk. |
| Static hosting | **Azure Static Web Apps** | Free tier; Standard if needed | Free SSL, CDN, custom domain, PR preview environments. Covered by the Azure for Nonprofits grant. |
| Media | **AWS S3** + **bunny.net CDN** | — | S3 is the most widely used, best-documented object store, with an S3-compatible API that keeps media portable; bunny.net serves and caches media cheaply so most reads never hit S3 egress (§6). |
| DNS | **Cloudflare DNS** | Free plan | Hosts the `winmetta.org` zone; records for Bunny hostnames stay DNS-only (not proxied). |
| Analytics | **Deferred beyond v1** | — | No analytics service or learner-event collection in Phase 0–2; see §4.4. |
| Infra as code | **Terraform** | — | Portable across clouds; see §8. |
| CI/CD | **GitHub Actions** | — | Free for public repos. |

### Browser and layout baseline

Design for both mobile and desktop: touch-friendly controls, keyboard access, readable line lengths, and responsive navigation. Expect most learners to use mobile devices. Keep pages lightweight, but legacy-browser compatibility below the Tailwind 4 baseline is not required: Chrome 111+, Safari 16.4+, Firefox 128+ ([Tailwind compatibility](https://tailwindcss.com/docs/compatibility)). Validate core flows on mobile Safari/Chrome and desktop browsers during implementation.

---

## 3. Monorepo Layout & Content Model

The directory names describe responsibilities: `apps/` contains deployable applications, `infra/` contains deployment and infrastructure definitions, and a top-level `content/` may be introduced if curated content becomes independent of the web app. `packages/` is for code with actual shared consumers.

This is the intended structure over time; future directories are not scaffolded in Phase 0:

```
winmetta-platform/
├── .github/workflows/
│   ├── ci.yml                 # lint, typecheck, test, build on every PR (Phase 0)
│   └── deploy-web.yml         # Azure Static Web Apps deploy: PR previews and review app (Phase 1); staging + production promotion (Phase 2)
├── apps/
│   ├── web/                   # Astro app (the only v1 app)
│   │   ├── src/
│   │   │   ├── pages/         # locale-prefixed routes; five starter pages in Phase 1, curricula later
│   │   │   ├── components/    # Astro components + React islands
│   │   │   └── content/       # localized pages, curated resources, library manifest and folder tags, classes; curricula later
│   │   ├── astro.config.mjs
│   │   └── package.json
│   ├── mobile/                # future
│   ├── desktop/               # future
│   └── api/                   # future, only if needed
├── packages/                  # created when first needed, not up front
│   ├── tsconfig/              # shared base tsconfig
│   ├── domain/
│   ├── i18n/
│   ├── ui/                    # shared components, once a second consumer exists
│   └── shared-types/          # shared Zod schemas, once code is shared
├── infra/                     # deployment/infrastructure definitions (Phase 2)
│   └── terraform/
│       ├── modules/platform/
│       └── environments/{staging,production}/
├── content/                   # optional future independent curated content
├── docs/
├── scripts/
│   └── setup-local-dev.sh
├── .env.example               # committed configuration documentation
├── .env.local                 # ignored developer-machine overrides
├── .nvmrc                     # 24
├── AGENTS.md / CLAUDE.md -> AGENTS.md
├── LICENSE                    # MIT
├── package.json
└── turbo.json
```

Start simple: keep code and Astro content collections inside `apps/web`, and extract a package only when a second consumer needs it. Phase 0 uses synthetic fixtures; real curated content arrives in Phase 1.

### Environment configuration

Keep one committed `.env.example` and one optional, ignored root `.env.local` for developer-machine overrides. The web config loads `.env.local`, with injected process variables taking precedence. Turbo includes this file in its cache dependencies. `SITE_URL` controls canonical/alternate URLs; `PUBLIC_ALLOW_INDEXING` is enabled only for public production builds. `PUBLIC_LIBRARY_CDN_BASE` is the public origin that serves library PDFs (default: the existing bunny.net pull zone). Public variables must never contain secrets.

Deployment workflows use GitHub `staging` and `production` environments, mapping their variables and secrets explicitly into build/deploy jobs. Do not maintain `.env.staging` or `.env.production` files. Phase 1's review build supplies its origin through CI with indexing disabled. Add `.env.test` later only if tests need it.

### Library model and discovery (Phase 1)

Classes and Dhamma Library are the two main navigation groups; discovery lives under `/[locale]/dhamma-library/`. The library has two sources that feed one search index:

* **S3 files (the bulk):** every PDF in the bucket `dhamma-library`, represented by generated records in a committed manifest (`apps/web/src/library/manifest.json`). Each record has a stable id, the exact S3 `key` (used only to build the CDN URL, URL-encoded), a display `title`, an optional `titleNote` (trailing parenthetical text), `tags` and `tagPath`, an inferred `language`, `sizeBytes`, `format` and `lastModified`. A lean `libraryFileSchema` in `lib/schemas.ts` validates it, separate from the curated `resourceSchema`. Human corrections (title, author, language, extra tags, hide, "same work as") live in `overrides.json`, keyed by S3 key. Never rename S3 objects to fix a title: it breaks public URLs.
* **Curated resources:** apps, blog-post links and other non-S3 items stay in the curated `resources` collection with source URLs and verification dates.

**Tags, not categories.** Every segment of an S3 key's folder path is a tag, with the leading number removed (`^[0-9၀-၉]+[။.]\s*`) and zero-width characters dropped, so `၁၀။ မြန်မာရှား (၁)/၁။ ဝိနိစ္ဆယများ/x.pdf` carries `မြန်မာရှား (၁)` and `ဝိနိစ္ဆယများ`. Display text keeps the original spelling; identity and matching use the normalized form. Folder-style navigation is built from the S3 key prefixes: one pre-rendered static page per folder at `/[locale]/dhamma-library/folders/<id>/` (page 1) and `.../<id>/<n>/` for later pages of 50 books, with breadcrumbs, subfolder links and counts, working without JavaScript. The library landing page shows the whole tree nested. Each folder has a stable ASCII id (`f001`, `f002`, …) in the committed `apps/web/src/library/folders.json`, keyed by its exact key prefix: the generator keeps existing ids, gives new folders the next number, never reuses an id, and reports entries whose folder no longer exists. If a folder is renamed in S3, edit that entry's `path` by hand to keep its URL; the build fails when a folder has no id. Display names are the folder segment with its number prefix removed; there are no English folder names yet, so English pages show the Burmese names (with `lang`), and any translation would be added as a field on the `folders.json` entry.

**Normalization** is one shared function used at build time and for queries: NFC; remove U+200B, U+200C and U+200D; lowercase; fold ဥ (U+1025) and ဉ (U+1009) to one letter; map Burmese digits ၀–၉ to ASCII 0–9; for Latin text only, fold diacritics (`pali` finds `Pāḷi`). Combining marks on Burmese characters are never stripped. The digit ၀ and the letter ဝ are not folded (open question for Burmese review). Keys and URLs always use the exact stored key.

**Search uses MiniSearch.** The index is built at build time, shipped as serialized JSON and loaded lazily on library pages only; folder pages stay static HTML, so browsing works before and without search hydration. Tokenization: Latin words split on whitespace and punctuation; Burmese runs are segmented into syllables by a deterministic syllable regex (a port of the Myanmar syllable-break rule, unit-tested; not `Intl.Segmenter`, whose Burmese segmentation differs across browsers) and indexed as 1–3 syllable n-grams, so unspaced and half-typed Burmese queries work. Indexed text: title, title note, tags and folder-path names. Queries split on spaces and every chunk must match (AND); matches start at syllable boundaries (`က` does not match inside `ကျ`) and may end mid-syllable. Ranking uses field boosts (title above tags and path, above title note), then tiers: exact title, title starts with the query, title contains it, match only in tags, path or note; ties by folder order, then title. A fuzzy pass (small edit distance, terms of sufficient length) fills a labelled **"Similar books"** group below the exact matches, and zero-result searches show fuzzy matches plus "more in <tag>" suggestions. Match English and Unicode Burmese metadata regardless of UI locale. No backend; no query logging or analytics.

**Budgets** (verified in a prototype before the UI is built, recorded here): serialized index at most about 400 KB gzipped, a query in well under 50 ms on a mid-range phone, results rendered in pages and never all at once. If Burmese relevance or the budget fails, reduce n-gram size or fall back to a substring-plus-tiers matcher behind a flag. A Burmese-speaker-reviewed golden-query suite (partial words, typos, spaced and unspaced queries, digits, ဥ/ဉ variants) runs in CI against the real manifest.

Represent the query, tag and page in URL parameters so deep links, history and locale switching preserve discovery state. Provide counts, active filters, reset and empty states. Translate UI labels using stable keys. Full-text search inside PDFs, OCR and transcription remain Phase 4.

**Known limitation: search queries must be typed in Unicode.** The index holds Unicode text (Zawgyi filenames are converted by the generator), so a query typed on a Zawgyi keyboard or font finds nothing, even for a book that is listed. Supporting Zawgyi-typed queries is a possible future improvement with no scheduled phase or date (see §10).

### Library content pipeline

**Phase 1: generate, don't hand-edit.** A script in `scripts/` lists the bucket with `aws s3api list-objects-v2` using a read-only profile (for example an IAM Identity Center profile) and writes the manifest, so builds and CI never need AWS credentials. It skips zero-byte objects, reports non-PDF files, detects duplicates by normalized path, name and size (for example the nine files that exist both with and without U+200B under `၉။ ပေမူများ`) and indexes each work once, fails on keys that do not round-trip through URL encoding, and sorts its output deterministically so PR diffs stay small. Files are served from the existing CDN base URL (`LIBRARY_CDN_BASE`, currently `https://dhamma-library.b-cdn.net`). The bucket has versioning enabled with a lifecycle rule that expires noncurrent versions after 90 days.

**Phase 4: adding new PDFs.**

1. A maintainer uploads PDFs with the AWS CLI (`aws s3 cp` or `sync`) into the correct numbered folder using a write-capable profile. An upload helper refuses names that need fixing (zero-width characters, non-NFC text, Zawgyi filenames, duplicates of an indexed file).
2. Replacing an existing file relies on S3 versioning for recovery and a Bunny cache purge for the changed paths.
3. The maintainer, or a manually triggered or scheduled GitHub Actions job using an OIDC role with read-only S3 access, re-runs the generator and opens a PR containing the manifest diff: added, changed and removed files, a duplicate report and new tags.
4. CI validates the schemas, the golden queries and the index size budget. A Burmese-speaking reviewer checks titles, tags, new folders and every Zawgyi conversion in `zawgyi-review.json`, recording corrections in `overrides.json`. Golden search tests that name a book removed or renamed in S3 are updated to a title that still exists, never loosened. Merging to `main` deploys.
5. The generator is the only way new files appear on the site; there is no hand-edited listing HTML. Full-text and OCR indexing, transcripts and the class archive are separate Phase 4 work.

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

Pages (library, class directory, curriculum pages) are pre-rendered at build time from repo content. Audio/video/PDF/images are served from a bunny.net pull zone on a custom domain (proposed `cdn.app.winmetta.org`), which fetches cache misses from a private AWS S3 bucket (§6). Application code only ever references the public CDN URL. No API call is needed to read or learn anything.

### Class schedule timezones

Store a recurring class's local day/time and source IANA timezone. Calculate dated occurrences and show both `America/Los_Angeles` (Pacific, with daylight saving) and `Asia/Yangon` (Myanmar), including each zone's date/day. A fixed pair of clock times becomes stale when Pacific daylight saving changes. Profile-based display timezone selection is deferred.

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

### 4.4. Analytics and metrics (deferred)

Product analytics and metric collection are deferred beyond v1 (Phase 0–2). Do not install an analytics SDK, send learner events, or add a collection service. IndexedDB progress and review state remain local features for learners, not telemetry.

The measures in [prd.md](prd.md) §6 are future candidates only. Revisit measurement feasibility, privacy, and service selection when collection is explicitly in scope; no vendor is selected now. In particular, aggregate counts alone cannot measure the same learner returning across days. Hosting/CDN operational logs are separate from product analytics and are not a promise of zero provider-side logging.

---

## 5. Internationalization & Burmese Text

Phase 0 builds the English (`en`) and Burmese (`my`) foundation; Phase 1 ships five public page types in both languages, serving online class students and independent learners worldwide. See implementation-plan.md §2–§3 for scope and acceptance criteria. Use `/en/…` and `/my/…` routes generated from stable page IDs; `/` is a language entry page. Switching language changes only the locale segment: the page, search terms, filters, query parameters and fragment are preserved, computed from the current URL at activation time. Locale-aware links and the switcher preserve the page identity. Explicit URL locale wins over optional browser-stored preference, and navigation works when storage is unavailable.

Keep a central extensible locale registry, keyed UI dictionaries, and localized page records inside `apps/web`. Page layouts are shared across locales. Shared class/resource records use stable IDs with localized display fields and independent source-language metadata. Use locale-aware formatting, document language/direction, canonical and alternate-language URLs, and text layouts that tolerate translation expansion. Avoid two-language conditionals throughout components so new locales need only registry, dictionary and content additions.

Validate all English/Burmese translations and UI keys at build time. For future content without a translation, show the source language with an explicit label. Never fabricate translations of teachings. UI locale does not determine content language, learner intent, or schedule timezone.

### Unicode-only Burmese (v1)

All Burmese-script content — UI strings, digitized curriculum, library metadata — uses **Unicode (Myanmar block, U+1000–U+109F)**. **Zawgyi**, the legacy non-Unicode encoding still found on older devices, older PDFs and much pre-2019 Myanmar web content, is **out of scope for v1** for UI text and curated content. The one exception is legacy Zawgyi filenames in the S3 library, handled by the manifest generator (below).

Zawgyi and Unicode look similar but are byte-incompatible; mixing them garbles text. The S3 library does include Zawgyi filenames (found in the 2026-10 audit: about 11 of 3,010), so the generator in the Library content pipeline detects and converts them with Google's open-source `myanmar-tools`, pinned to **1.1.3** because 1.2.0 on npm ships unbuilt sources and cannot be required. The detector alone is not safe for this corpus: Pāḷi titles full of stacked consonants (ဓမ္မ, ပတ္တိ) often score as Zawgyi and the converter would corrupt them (about 140 such titles). A title is converted only when the detector says at least 0.9 **and** it contains a marker impossible in valid Unicode (glyph-only code points U+1060–U+1097, ေ before its consonant, or a virama not followed by a consonant). Titles with a marker but a low score (usually typos) are reported as suspicious and left unchanged; high scores without a marker are reported as ambiguous and left unchanged. Every conversion is written to `apps/web/src/library/zawgyi-review.json` for a Burmese speaker to review; wrong ones are corrected with a `title`/`titleNote` override in `overrides.json`, which wins on the next run. S3 keys are never renamed. Folder names and curated content must be Unicode (the generator warns on Zawgyi folder names). Ship a Unicode Burmese web font (e.g. Noto Sans Myanmar) so pages render consistently on older devices.

---

## 6. Hosting & Domains

Win Metta has an Azure for Nonprofits grant ($2,000/year). It covers only first-party Azure services (the static hosting here), doesn't roll over, and must be reactivated annually — a lapse year should be planned for, not a surprise. Media storage on AWS S3 and delivery on bunny.net are outside the grant and paid separately.

**Cost policy:** prefer free tiers and nonprofit programs, but spending money on the tech stack is acceptable. Donation funds may pay for development and maintenance.

`winmetta.org` (WordPress) is unchanged by this repo. The platform lives on a subdomain:

| Host | Points to | Purpose |
| --- | --- | --- |
| `winmetta.org` (+ `www`) | Existing WordPress hosting | Blog/news, About, existing pages — untouched. |
| `app.winmetta.org` | Azure Static Web Apps (production) | This platform's frontend. `app.` chosen as the most understandable label for less tech-fluent users. |
| `staging.app.winmetta.org` | Azure Static Web Apps (staging) | Pre-release verification, `noindex`. |
| `cdn.app.winmetta.org` (proposed) | bunny.net pull zone (CNAME) | Public platform media, backed by AWS S3. Staging uses its own hostname and bucket. |

`winmetta.org` DNS is managed in **Cloudflare** (DNS only, free plan); add the app and CDN hostnames as CNAME records there. Keep records that point to Bunny **DNS-only (unproxied)** so Bunny serves the traffic directly. Existing WordPress records stay intact. WordPress navigation can link to `app.winmetta.org`, and the app can link back for blog/news.

| Component | Where | Why |
| --- | --- | --- |
| Astro build output | **Azure Static Web Apps** | SSL, CDN, custom domain, PR previews. Free tier caps at 100 GB/month bandwidth; heavy media goes through the CDN below, not this path. |
| Audio, video, PDF, images | **AWS S3** origin + **bunny.net** CDN | S3 is outside the Azure grant, so it is a paid service, but storage is cheap. S3 charges internet egress (about $0.09/GB beyond a small free allowance), so all public traffic goes through bunny.net, which caches media and pulls from S3 only on cache misses. Bunny delivery is billed separately; both costs are small at low traffic and acceptable per the cost policy. Check whether AWS nonprofit credit programs apply. |

### Media delivery setup

* **Storage:** separate S3 buckets for staging and production (e.g. `winmetta-media-staging`, `winmetta-media`) so test uploads never mix with the real library. Block all public access on the buckets.
* **CDN:** a bunny.net pull zone per environment with the S3 bucket as the origin, on the custom hostname `cdn.app.winmetta.org` (staging: its own hostname) with a certificate for that exact hostname.
* **Origin access:** keep the bucket private and use Bunny's S3 origin authentication with a dedicated IAM user whose policy is read-only (`s3:GetObject`) on that bucket only. Set the pull zone's origin region to match the bucket. This means the raw S3 URL cannot bypass the CDN. **Verify Bunny's S3 authentication against your bucket's region during Phase 2 before relying on it.**
* **Credentials:** AWS access keys and Bunny API keys live in secret configuration only, never in client code or committed files. Use separate IAM credentials for the read-only Bunny origin user and for maintainer uploads (write access, e.g. via the AWS CLI `aws s3 sync`).
* Use versioned object paths for replaced media. Public access requires no learner account or token.
* **Current state (Phase 1 source):** the existing bucket `dhamma-library` (us-east-2) and the Bunny pull zone `dhamma-library.b-cdn.net` already serve the library. Phase 1 reads and links to them as they are; Phase 2 decides whether to keep them or migrate to `cdn.app.winmetta.org`. Do not record the AWS account number in this public repo.

Release checks: anonymous fetches succeed on cache misses and hits; audio/video seeking (range requests) works; MIME types, cache headers and CORS for browser fetches are correct.

**Portability:** S3's API is the de facto standard, so media can move to another S3-compatible store (Backblaze B2, Cloudflare R2, MinIO) by re-pointing the CDN origin. Pages reference only the public CDN URL, and bucket access is limited to the upload script and the Bunny origin. Avoid cloud-specific SDKs in application code; keep the static output host-agnostic.

---

## 7. Environments & CI/CD

Deliberately small, for a volunteer team. Rollout by phase:

* **Phase 0:** local development plus `ci.yml` (lint, typecheck, tests, build). No deploy.
* **Phase 1:** add the deploy workflow (`deploy-web.yml`) to a single, non-public Azure Static Web App reachable at its default Azure hostname, with PR previews. It is `noindex` and not linked publicly, so pages can be reviewed in a real environment. The site is **not public** yet.
* **Phase 2:** formalize with Terraform, custom domains, media storage/CDN, and separate staging and production environments with a promotion step.

| Environment | Where | Purpose |
| --- | --- | --- |
| **Local** | `npm run dev` | Development. No Docker, no database. |
| **PR previews** | Azure Static Web Apps' auto-generated ephemeral URL (from Phase 1) | Per-pull-request check; torn down when the PR closes. |
| **Staging** | `staging.app.winmetta.org` (its own Static Web App) + separate media storage and CDN hostname (Phase 2) | Pre-release verification with the real build. Synthetic or scrubbed data only where content isn't public. |
| **Production** | `app.winmetta.org` (Phase 2) | Live site. |

Staging and PR previews must not be indexed: send `noindex` and, if unfinished content needs hiding, restrict access. Access restriction on Static Web Apps may require the **Standard** plan (paid, ~$9/month per app) — acceptable, but verify current plan features before relying on it.

**Flow (complete by Phase 2):**

1. **PR opened** → `ci.yml` runs lint, typecheck, tests, build → Static Web Apps deploys a preview (from Phase 1).
2. **Merge to `main`** → automatic deploy to **staging** (the single review app in Phase 1).
3. **Promotion to production** (Phase 2) is a deliberate step — a tagged release or a GitHub Actions environment with manual approval. For a small team, a conscious approval is a sufficient safety net; canary or blue/green rollouts aren't worth the overhead. Rollback is redeploying the previous tag.

Enable GitHub secret scanning and push protection on the repo (free for public repos) in Phase 0.

---

## 8. Infrastructure Provisioning

**Terraform**, not manual Portal clicks — the same tool works across Azure, AWS, Cloudflare, bunny.net and other providers, so a future host move changes provider blocks, not workflow. Terraform has a learning curve; the Phase 2 footprint is small (two Static Web Apps, S3 buckets with IAM, Bunny pull zones, Cloudflare DNS records), so a first pass can be done by hand and codified right after. Use the Bunny Terraform provider if it covers the needed resources; otherwise document the manual Bunny steps. Confirm the team is comfortable before committing to it. (The single Phase 1 review app may be created by hand.)

```
infra/terraform/
├── modules/platform/         # Static Web App, S3 bucket + IAM, Bunny pull zone, Cloudflare DNS records
├── environments/staging/     # Calls the module with staging names
└── environments/production/  # Calls the module with production names
```

* **State:** Terraform Cloud free tier (remote state and locking, nothing in git).
* **Public repo rule:** commit only `.tfvars.example` with placeholders; real `.tfvars`, subscription/tenant IDs and connection strings stay untracked.
* `terraform plan` runs on PRs touching `infra/`; `terraform apply` is a manual maintainer action, never automatic.
* **CI auth:** an Azure Service Principal scoped to the needed resource group only, stored as a GitHub Actions secret.

---

## 9. Experimentation (Future)

Not needed for v1. If a concrete learning-outcome question arises (e.g. does one practice-pacing approach improve return-to-learn?), evaluate lightweight options at that time (self-hosted GrowthBook is one candidate). Experiments should measure learning outcomes, not engagement — see the Calm by Default principle in [prd.md](prd.md) §3 — and must establish an appropriate privacy and measurement design when analytics is introduced (§4.4).

---

## 10. Future Directions (Tentative)

*Everything here is a starting idea, not a design. Revisit and rewrite when the relevant phase begins.*

### Backend & database (likely Phase 5)

When a feature needs server state (accounts, progress sync, dynamic content), add:

* **Fastify + TypeScript** API in `apps/api`, run as a plain Docker container on **Azure Container Apps** (Consumption plan scales to zero).
* **PostgreSQL 18** on Azure Database for PostgreSQL – Flexible Server (Burstable). Vanilla Postgres only, so it stays portable. Note this is a real fixed cost; stopped Flexible Servers restart automatically after ~7 days.
* `api.winmetta.org` as a sibling subdomain; a staging environment with its own separate database at that point.
* Local dev against a native Postgres at `localhost:5432/winmetta_dev`.

### Accounts & progress sync (likely Phase 5)

* Core content stays fully usable with no login; accounts are optional and only for syncing progress/bookmarks across devices. Existing IndexedDB data migrates into the account on first sign-in.
* Passwordless. Candidate implementation: **Better Auth** inside the Fastify app, storing users in the same Postgres.
* Sign-in methods: **Google** first, plus **email magic link sent via SendGrid**. Facebook and Apple can be added later if learners ask. Avoid SMS OTP.
* Collect the minimum data needed and state its purpose clearly.

### Zawgyi-typed search queries (no scheduled phase)

Library search assumes Unicode input (see "Known limitation" in §3). Learners on older phones may still type Zawgyi. Options when this is taken up: detect Zawgyi in the query in the browser and convert it before searching (the detector and converter in `myanmar-tools` are small and run client-side), or index the original Zawgyi filename text as an extra searchable field. Either needs a Burmese-speaker review of the golden queries and the 0.9 detector threshold, and an acceptance test with real Zawgyi input. No date is set; it is not part of Phases 0–2.

### Offline support

Offline use (downloaded curriculum content, audio and library files) is desirable but not a v1 requirement. When taken up, a PWA (service worker + cache) is the lowest-friction starting point. Don't design v1 pages around it beyond keeping assets cacheable.

### Native apps (Phase 6)

Electron desktop and Capacitor mobile builds may wrap the web app later. Notes for then: Google and Apple block OAuth in embedded webviews, so native apps must hand sign-in off to the system browser and catch the redirect via a custom URI scheme (`app.setAsDefaultProtocolClient` in Electron; `@capacitor/app` `appUrlOpen` in Capacitor). Desktop auto-update can use `electron-builder` + `electron-updater` against GitHub Releases.
