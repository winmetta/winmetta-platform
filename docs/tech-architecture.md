# Technical Architecture

**Status:** Phases 0–2 (foundation code, bilingual pages, infrastructure & deployment) are specified in detail in [implementation-plan.md](implementation-plan.md). Everything under "Future" is a *tentative direction* recorded so ideas aren't lost — it is **not** a source of truth and will be redesigned when that phase is actually planned.

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
| (AWS S3 + CloudFront)             |
|  - pre-rendered pages             |
|  - React islands (practice)       |
|  - progress stored in IndexedDB   |
+-----------------------------------+
        | Browser fetches public library PDFs
        v
bunny.net CDN (existing pull zone dhamma-library.b-cdn.net)
        | Origin fetch on cache miss
        v
AWS S3 bucket dhamma-library (existing)

Later: new media buckets and a cdn.app.winmetta.org hostname (Phase 3, see §6).

Future (tentative, see §10): Fastify API + PostgreSQL on AWS (container hosting + RDS),
accounts (Google sign-in, email link via SendGrid), offline/PWA, native shells.
```

Core content must always work with **no account and no login** (PRD §4.6).

---

## 2. Technology Choices (v1)

Versions were checked against the npm registry, the Node.js release schedule and GitHub releases on 2026-10-06; re-check before upgrading and never copy a version from memory. A newer major exists for npm (12.2, while Node 24 bundles npm 11); adopt it deliberately, not by default. Linting uses ESLint 10 with `typescript-eslint`, `eslint-plugin-astro` 3 and `eslint-plugin-jsx-a11y-x`, the maintained fork of `eslint-plugin-jsx-a11y` (the original's latest release, 6.10.2, does not support ESLint 10; the fork's rules are named `jsx-a11y-x/…`). Switch back to the original if it adds ESLint 10 support (checked 2026-10-06).

| Layer | Selection | Version baseline | Why |
| --- | --- | --- | --- |
| Runtime | **Node.js** | 24.x (Active LTS) | Longest support runway. Node 22 is Maintenance LTS (EOL April 2027). |
| Package manager | **npm** | 11.x (bundled) | No extra tool for contributors to learn. |
| Monorepo | **Turborepo + npm workspaces** | ^2.11 | Lightweight, standard Node tooling. |
| Language | **TypeScript** (strict) | ^6.0 | TypeScript 7.0 is stable (7.0.2 on npm as of 2026-10-06), but `typescript-eslint` 8.71 supports only TypeScript below 6.1, so stay on 6.x until it supports 7. |
| Web app | **Astro** + **React** islands | Astro ^7.3, React ^19.3 | Ships almost no JS by default; pre-renders content for SEO and low-bandwidth connections and supported devices; React only where interactivity is needed. |
| Content & schemas | **Astro content collections** with **Zod** | — | Zod is Astro's built-in schema layer and the most popular TypeScript validator. Content lives in the repo as Markdown/JSON. |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Tailwind ^4.3 | Widely used; components are copied into the repo, so no dependency abandonment risk. |
| Static hosting | **AWS S3 + CloudFront** | Private S3 bucket with origin access control behind CloudFront; ACM certificates | Cheap and low-maintenance: the site is small, CloudFront's free tier (1 TB/month transfer at the time of writing; verify) covers it, and it sits in the AWS account that already holds the media. Everything can be defined in code with Pulumi. |
| Media | **AWS S3** + **bunny.net CDN** | Existing library bucket and pull zone in Phase 2; new media infrastructure in Phase 3 | S3 is the most widely used, best-documented object store, with an S3-compatible API that keeps media portable; bunny.net serves and caches media cheaply so most reads never hit S3 egress (§6). |
| DNS | **AWS Route 53** | One hosted zone for `app.winmetta.org` (about $0.50/month) | Delegated from DreamHost, which keeps `winmetta.org` itself. Holds the app and ACM validation records (more names, such as a CDN or staging host, are added when needed), all managed by Pulumi. |
| Analytics | **Deferred beyond v1** | — | No analytics service or learner-event collection in Phase 0–2; see §4.4. |
| Infra as code | **Pulumi (TypeScript)** | — | The same language as the app, so one toolchain, editor setup and test runner for the volunteer team; covers AWS natively and other providers through bridged providers; see §8. |
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
│   └── deploy-web.yml         # AWS deploy to production (S3 sync + CloudFront invalidation via GitHub OIDC), rollback by ref (Phase 2)
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
│   └── pulumi/
│       ├── index.ts               # reads the stack config and creates the platform component
│       ├── platform.ts            # ComponentResource: site, DNS (media is added in Phase 3)
│       └── Pulumi.production.yaml
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

Deployment workflows use the GitHub `production` environment (a `staging` environment is added with the first API or backend), mapping its variables and secrets explicitly into build/deploy jobs. Do not maintain `.env.staging` or `.env.production` files. Indexing stays off until the public launch (`PUBLIC_ALLOW_INDEXING=false`), then the production environment sets it to `true`. Add `.env.test` later only if tests need it.

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

**Phase 1: generate, don't hand-edit.** A script in `scripts/` lists the bucket with `aws s3api list-objects-v2` using a read-only profile (for example an IAM Identity Center profile) and writes the manifest, so builds and CI never need AWS credentials. It skips zero-byte objects, reports non-PDF files, detects duplicates by normalized path, name and size (for example the nine files that exist both with and without U+200B under `၉။ ပေမူများ`) and indexes each work once, fails on keys that do not round-trip through URL encoding, and sorts its output deterministically so PR diffs stay small. Files are served from the existing CDN base URL (`PUBLIC_LIBRARY_CDN_BASE`, currently `https://dhamma-library.b-cdn.net`). The bucket has versioning enabled with a lifecycle rule that expires noncurrent versions after 90 days.

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

Pages (library, class directory, curriculum pages) are pre-rendered at build time from repo content. Library PDFs (and, from Phase 3, other media) are served from a bunny.net pull zone, which fetches cache misses from a private AWS S3 bucket (§6). Application code only ever references the public CDN URL. No API call is needed to read or learn anything.

### Class schedule timezones

Store a recurring class's local day/time and source IANA timezone. Calculate dated occurrences and show both `America/Los_Angeles` (Pacific, with daylight saving) and `Asia/Yangon` (Myanmar), including each zone's date/day. A fixed pair of clock times becomes stale when Pacific daylight saving changes. Profile-based display timezone selection is deferred.

### 4.2. Content refresh

Static generation means content changes appear after a rebuild:

```
Content change merged to main (new class time, new library entry, new LLB content)
   -> GitHub Actions builds the Astro site
   -> Deployed to AWS S3 + CloudFront
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

Permanent hosting and media both live in **AWS**, where Win Metta already has an account. The Azure for Nonprofits grant is not stable enough to build on (it does not roll over and must be renewed yearly), so nothing permanent depends on it: the site, its DNS targets, data and CI deploys must not require Azure. Azure may still be used for occasional or short-lived workloads (experiments, one-off batch jobs) while the grant lasts. AWS nonprofit credits, if approved, are a bonus and not part of the plan. Delivery of media through bunny.net is paid separately.

**Cost policy:** prefer free tiers and nonprofit programs, but spending money on the tech stack is acceptable. Donation funds may pay for development and maintenance.

**Phase 2 scope (decided 2026-10-06):** one production environment, labelled Beta in the UI. There is no staging environment or PR preview host yet (they come with the first API or backend, §10), and no new media infrastructure: the existing library bucket and pull zone keep serving the PDFs, outside Pulumi.

`winmetta.org` (WordPress) is unchanged by this repo. The platform lives on a subdomain:

| Host | Points to | Purpose |
| --- | --- | --- |
| `winmetta.org` (+ `www`) | Existing WordPress hosting | Blog/news, About, existing pages — untouched. |
| `app.winmetta.org` | AWS CloudFront (production) | This platform's frontend. `app.` chosen as the most understandable label for less tech-fluent users. |
| `dhamma-library.b-cdn.net` | Existing bunny.net pull zone | Library PDFs, backed by the existing `dhamma-library` S3 bucket. Unchanged in Phase 2. |
| `staging.app.winmetta.org`, `cdn.app.winmetta.org` (later, not Phase 2) | CloudFront staging; bunny.net pull zone (CNAME) | Staging arrives with the first API or backend; the CDN hostname with new platform media in Phase 3. |

`winmetta.org` stays on DreamHost's name servers, because DreamHost's free nonprofit shared hosting requires it, so its DNS is managed in the DreamHost panel. The platform's names live in a separate **Route 53** hosted zone for `app.winmetta.org`, delegated once by adding four NS records for `app` in DreamHost's panel (confirm the panel accepts NS records for a subdomain before building on it). The zone, the production alias records and the ACM validation CNAMEs are then created in Route 53 by Pulumi; later hosts are added to the same zone. Delegation must be live before ACM can validate the certificate, so the first apply is staged (zone, then NS records in DreamHost, then certificate and distribution; see implementation-plan.md §4). Existing WordPress records stay intact. WordPress navigation can link to `app.winmetta.org`, and the app can link back for blog/news.

| Component | Where | Why |
| --- | --- | --- |
| Astro build output | **AWS S3 + CloudFront** | SSL (ACM), CDN, custom domain through a Route 53 alias record. |
| Library PDFs | Existing **AWS S3** bucket `dhamma-library` + **bunny.net** CDN | S3 charges internet egress (about $0.09/GB beyond a small free allowance), so all public traffic goes through bunny.net, which caches and pulls from S3 only on cache misses. bunny.net is already used this way for the Dhamma Library PDFs and as a cache in front of the WordPress site. Check whether AWS nonprofit credit programs apply. |
| New audio, video, images (Phase 3) | **AWS S3** origin + **bunny.net** CDN | Same pattern, set up when a phase needs it (see "Media delivery"). |

### Static site delivery

* **Origin:** a private S3 bucket reachable only through CloudFront (origin access control). Public access on the bucket stays blocked.
* **Certificate and region:** the CloudFront certificate must be in `us-east-1` (use an aliased provider in Pulumi). Pick one region for the bucket and the Pulumi state and record it.
* **Directory URLs:** the site uses `trailingSlash: 'always'`, and S3 behind origin access control does not serve directory indexes. A CloudFront viewer-request Function maps `/en/about/` to its `index.html` and redirects a missing trailing slash.
* **404:** a missing key returns 403 from S3 with origin access control, so CloudFront answers 403 and 404 with the site's real 404 page (`apps/web` needs a `404.astro`).
* **Caching:** `aws s3 sync` sets no `Cache-Control`, so the deploy sets it per path: content-hashed `_astro/*` and `library-data/*.<hash>.json` are `immutable` for a year, HTML and icons are short or no-cache, and the deploy invalidates `/*`. Old hashed files are kept about a week after a deploy so an already-open page can still load its lazy search index.
* **Headers:** a response headers policy adds security headers. Indexing is controlled only by the build variable `PUBLIC_ALLOW_INDEXING` (meta tag and `robots.txt`), never by a CloudFront header, so the two cannot disagree.
* **Compression:** enable CloudFront automatic compression for text, including the JSON search index.

### Media delivery (existing library now, new media in Phase 3)

* **Current state (Phase 1 source, unchanged in Phase 2):** the existing bucket `dhamma-library` (us-east-2) and the Bunny pull zone `dhamma-library.b-cdn.net` already serve the library. They are not imported into Pulumi and not migrated; builds use the default `PUBLIC_LIBRARY_CDN_BASE`. Moving to `cdn.app.winmetta.org` later is a change to that one variable plus a Bunny hostname, and needs its own decision (about 115 GiB). Do not record the AWS account number in this public repo.
* **New media (Phase 3 design):** a separate S3 bucket for platform media (and a staging one once staging exists), with all public access blocked, served by a bunny.net pull zone on the custom hostname `cdn.app.winmetta.org` with a certificate for that exact hostname.
* **Origin access:** keep the bucket private and use Bunny's S3 origin authentication with a dedicated IAM user whose policy is read-only (`s3:GetObject`) on that bucket only. Set the pull zone's origin region to match the bucket. This means the raw S3 URL cannot bypass the CDN. **Verify Bunny's S3 authentication against your bucket's region before relying on it.**
* **Credentials:** AWS access keys and Bunny API keys live in secret configuration only, never in client code or committed files. Use separate IAM credentials for the read-only Bunny origin user and for maintainer uploads (write access, e.g. via the AWS CLI `aws s3 sync`).
* Use versioned object paths for replaced media. Public access requires no learner account or token.

Release checks for new media: anonymous fetches succeed on cache misses and hits; audio/video seeking (range requests) works; MIME types, cache headers and CORS for browser fetches are correct.

**Portability:** S3's API is the de facto standard, so media can move to another S3-compatible store (Backblaze B2, MinIO) by re-pointing the CDN origin. Pages reference only the public CDN URL, and bucket access is limited to the upload script and the Bunny origin. Avoid cloud-specific SDKs in application code; keep the static output host-agnostic.

---

## 7. Environments & CI/CD

Deliberately small, for a volunteer team. Rollout by phase:

* **Phase 0:** local development plus `ci.yml` (lint, typecheck, tests, build). No deploy.
* **Phase 1:** no deployment. Pages are built and reviewed locally, and `ci.yml` keeps checking every PR.
* **Phase 2:** add the deploy workflow (`deploy-web.yml`), static hosting on S3 + CloudFront, Pulumi, the custom domain and one production environment, labelled Beta.
* **With the first API or backend (Phase 5, §10):** add a staging environment with its own stack, database and integration tests, and consider a PR preview host.

| Environment | Where | Purpose |
| --- | --- | --- |
| **Local** | `npm run dev` | Development. No Docker, no database. |
| **PR builds** | Workflow artifact from `ci.yml` (added in Phase 2) | Per-pull-request check of the built site; no hosted preview in Phase 2. |
| **Production** | `app.winmetta.org` (Phase 2) | Live site. The first deploy is unindexed and not linked from winmetta.org so reviewers can run the launch gates (implementation-plan.md §4); launch switches indexing on and links to it. |

**Why no staging yet:** the site is static with no backend or database, so a second environment would add a bucket, certificate, role and stack without testing much, and the staging bytes could not be promoted anyway because `SITE_URL` and `PUBLIC_ALLOW_INDEXING` are baked in at build time. The safety nets are the required-reviewer approval on the `production` GitHub environment, a post-deploy smoke test against the live site, and rollback by redeploying an earlier ref. Stack parameters are per stack, so adding `staging` later is a new config file and `pulumi up`.

**Flow (Phase 2):**

1. **PR opened** → `ci.yml` runs lint, typecheck, tests, build; the built site is uploaded as a workflow artifact (a Phase 2 addition to `ci.yml`).
2. **Merge to `main`** → `deploy-web.yml` waits for a required reviewer to approve the `production` environment, builds with the production variables, syncs to S3, invalidates CloudFront and runs the Playwright smoke test against the live URL.
3. **Rollback** is a manual run of the same workflow (`workflow_dispatch`) with an earlier ref. A bad deploy goes straight to production, so keep the smoke test and the approval step.

Until launch, the production environment variable `PUBLIC_ALLOW_INDEXING` is `false`, so every page sends `noindex`. `robots.txt` stays allow-all but leaves out the sitemap: a `Disallow` would stop crawlers from fetching the pages, so they would never see the `noindex` tag. Launch sets it to `true` and redeploys. CI authenticates to AWS only through GitHub OIDC (§8), and fork pull requests get no AWS access.

Enable GitHub secret scanning and push protection on the repo (free for public repos) in Phase 0.

---

## 8. Infrastructure Provisioning

**Pulumi in TypeScript**, not manual console clicks. The infrastructure is ordinary TypeScript, so the team keeps one language, one package manager, one editor setup and Vitest for infrastructure tests. The Phase 2 footprint is small (a site bucket with a CloudFront distribution and ACM certificate, a CloudFront Function, the Route 53 zone and records, and the deploy role), so a first pass can be done by hand and codified right after. Pulumi covers AWS natively; for bunny.net in Phase 3 use a bridged provider (`pulumi package add terraform-provider …`) if one covers the needed resources, otherwise document the manual Bunny steps. A future host move changes the provider calls in one component, not the workflow. Confirm the team is comfortable before committing to it.

```
infra/pulumi/
├── index.ts                  # reads the stack config and creates the platform component
├── platform.ts               # ComponentResource: site bucket + CloudFront + ACM + Function, Route 53 zone and records, deploy role
└── Pulumi.production.yaml    # non-secret config for the production stack
```

* **Bootstrap (one time, outside Pulumi):** the state bucket, the KMS key and the GitHub OIDC identity provider must exist before `pulumi login s3://…`, so a maintainer creates them once by hand or with a short script, and the runbook records their names (never the account ID).
* **State and secrets:** a private, versioned S3 bucket as the Pulumi backend and an AWS KMS key as the secrets provider, so state, locking and encryption stay inside the one AWS account and need no extra service or subscription. Pulumi Cloud's free individual tier is an alternative if the team prefers its UI. Nothing is stored in git.
* **Public repo rule:** commit only non-secret `Pulumi.<stack>.yaml`; secrets are set with `pulumi config set --secret` or come from the environment, and access keys and connection strings stay out of the repo. Phase 2 needs no secrets, so keep the stack config secret-free. The KMS secrets provider still stores an encrypted data key with the stack, so the read-only preview role most likely needs `kms:Decrypt` on that one key (Pulumi's documentation implies this for stack operations but does not spell it out for previews; confirm with a dry run in step 3). With secret-free config that decrypts nothing sensitive. Revisit this before the first real secret, for example by making previews maintainer-triggered only.
* `pulumi preview` runs on PRs touching `infra/` with a read-only role; `pulumi up` is a manual maintainer action, never automatic.
* **CI auth:** GitHub OIDC trust to AWS IAM roles, so no long-lived AWS keys are stored in GitHub. The production deploy role trusts only this repository's `production` environment and may touch only the site bucket and its distribution (sync and invalidation). The Pulumi preview role is separate and read-only. Workflows use `pull_request`, never `pull_request_target`, and fork pull requests get no OIDC token.

---

## 9. Experimentation (Future)

Not needed for v1. If a concrete learning-outcome question arises (e.g. does one practice-pacing approach improve return-to-learn?), evaluate lightweight options at that time (self-hosted GrowthBook is one candidate). Experiments should measure learning outcomes, not engagement — see the Calm by Default principle in [prd.md](prd.md) §3 — and must establish an appropriate privacy and measurement design when analytics is introduced (§4.4).

---

## 10. Future Directions (Tentative)

*Everything here is a starting idea, not a design. Revisit and rewrite when the relevant phase begins.*

### Backend & database (likely Phase 5)

When a feature needs server state (accounts, progress sync, dynamic content), add:

* **Fastify + TypeScript** API in `apps/api`, run as a plain Docker container on AWS (**App Runner** or ECS Fargate; choose when the backend is real).
* **PostgreSQL 18** on Amazon RDS (or Aurora Serverless). Vanilla Postgres only, so it stays portable. Note this is a real fixed cost.
* `api.winmetta.org` as a sibling subdomain; a staging environment with its own separate database and integration tests at that point (Phase 2 has production only, §7).
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
