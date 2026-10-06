# Implementation Plan: Phases 0–2 (plus the Phase 4 library pipeline outline)

The first three phases take the project from an empty repo to a public, bilingual site running in staging and production. Each phase has one purpose so a small volunteer team can finish and review it before starting the next.

| Phase | Goal | Deployed? |
| --- | --- | --- |
| **0 — Foundation code** | Repo scaffold: a basic Astro app with all the libraries, tooling and English/Burmese (`en`/`my`) support the site needs. No real pages or content, no deploy. | No (local only) |
| **1 — Bilingual pages** | Home, About, Privacy, the Classes group (classes with a weekly schedule, Sayadaws, Dhamma Study Groups, Retreats and Zoom help) and Dhamma Library (the whole S3 PDF library, tag browsing and fuzzy Burmese search), in English and Burmese, with curated public content. Reviewed from local builds; no deployment. | No (local only) |
| **2 — Infrastructure & deployment** | Pulumi (TypeScript), domains, AWS hosting (S3 + CloudFront), AWS S3 + bunny.net media delivery, Route 53 DNS, and staging and production environments with promotion. | Yes (public) |

Later phases (LLB lessons, the library upload pipeline in §5, accounts, native apps) are in [prd.md](prd.md) §7. Scope per [prd.md](prd.md) (§4.7, §7) and [tech-architecture.md](tech-architecture.md) (§0): one static Astro web app designed for mobile and desktop — no backend, no database, no desktop/mobile apps.

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

* Repo governance, tooling and dev environment (checklist below; config in §6–§8).
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
* [x] Add `.gitignore` covering `node_modules`, build output, `.env*`, Pulumi local state (`.pulumi/`) **before** any such file exists.
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

## 3. Phase 1 — Bilingual Pages

**Goal:** Home, About, Privacy, the Classes group (Classes, Sayadaws, Dhamma Study Groups, Retreats, Zoom help) and Dhamma Library, complete in English and Burmese, with concise curated public content, the full S3 PDF library indexed with tag browsing and fuzzy Burmese-aware search. Uploading new PDFs and refreshing the index is the Phase 4 pipeline (tech-architecture.md §3, "Library content pipeline"). Phase 1 involves no hosting or deployment: pages are reviewed from local builds and the existing `ci.yml` checks. Static hosting and the deploy workflow are Phase 2, and the site is not public until then.

### Two primary user groups

1. **Students attending online Zoom classes:** quickly find their class, the schedule, joining information and relevant study resources.
2. **Anonymous independent learners worldwide:** discover Burmese-language learning resources and Dhamma (Buddhist teachings), with no assumed class enrollment, nationality, heritage or prior familiarity.

Both groups can use every page without an account, onboarding questionnaire or profile. **Classes** and **Dhamma Library** are the two main page groups: Classes primarily supports online students, the library primarily supports independent discovery. Class pages link to relevant library entries, and both groups remain open to everyone. Home offers clear paths to both; neither geography nor interface language decides which path a learner may take.

### Pages

Routes are relative to the locale prefix (`/en/` or `/my/`).

| Page | Route | Content and purpose |
| --- | --- | --- |
| Home | `/` | Short introduction to Win Metta and the platform, with clear links to Classes and Dhamma Library for both user groups. |
| About | `/about/` | Concise mission, Theravāda teaching context, learning activities and public contact information. Link to the main organization site for further detail. |
| Privacy | `/privacy/` | Plain-language explanation specific to the platform as implemented: local language preferences and any other browser storage actually used, deferred product analytics, hosting/CDN operational processing, external links and a contact for questions. Do not copy WordPress policy text or claim that no provider processes visitor data. Describe lesson progress storage only when implemented. |
| Classes | `/classes/` | Live-streamed Zoom classes taught by the Sayadaws: a weekly schedule table (one Time column with a time zone picker, Pacific by default, kept in `?tz=`), a card per class with the Sayadaw, the language it is taught in, weekly times, the next class in Pacific and Myanmar time, the Join on Zoom button with meeting ID and public passcode, watch links (YouTube, Facebook), recordings and course details, a reminder to set your correct name before joining, an Archive section for stopped classes, and links to the Sayadaws and Retreats pages. Verified against winmetta.org with source URLs and dates; never infer missing times. |
| Dhamma Study Groups | `/study-groups/` | The Zoom-only group-reading sessions (not streamed or recorded), with the same schedule table and cards. |
| Sayadaws | `/classes/sayadaws/` and `/classes/sayadaws/<id>/` | A list and a biography page per Sayadaw (portrait, place, biography in the original language with a draft-translation note on unreviewed English, their classes and retreats). Listed under Classes in the menu. "ဆရာတော်" is for monks only. |
| Retreats | `/classes/retreats/` and `/classes/retreats/<id>/` | The "none scheduled" notice or the upcoming retreats, how retreats work, and a searchable archive of 15 past retreats (filters for year, format, length and Sayadaw, kept in the URL) with a detail page for each. Listed under Classes in the menu. |
| Zoom help | `/zoom-help/` | Short cards and numbered steps with emoji: install Zoom, set your name before joining, join, microphone and camera, raise your hand, breakout rooms; linked from the footer and the Classes pages. |
| Dhamma Library | `/dhamma-library/` | Unified discovery for Burmese and Dhamma resources: books and PDF files from S3 plus curated app URLs, blog posts and other links, with every PDF in the S3 bucket indexed: folder-style tag browsing and fuzzy search tuned for Burmese (see "Dhamma Library: S3 file index, tags and search"). Other resource types (apps, blog links) stay curated. |

Use shared mobile/desktop navigation for Classes (with Sayadaws and Retreats in a submenu), Dhamma Study Groups and Dhamma Library; keep About, Privacy and Zoom help easy to reach in the footer. The language switcher is visible and keyboard accessible on both layouts.

### Dhamma Library: S3 file index, tags and search

Phase 1 indexes **every PDF in the existing S3 bucket `dhamma-library`** (audited 2026-10-03: 3,040 objects, about 115 GiB, mostly Burmese books in about 20 numbered folders). All of these files are already public via winmetta.org and the bunny.net CDN, so Phase 1 adds links and search, not new republication. Design, data model and the generator are in [tech-architecture.md](tech-architecture.md) §3 ("Library model and discovery" and "Library content pipeline").

* **Audience and search behavior:** most visitors type Burmese words and do not know a book's title or author, so search is **fuzzy** and surfaces similar books, not only exact matches. Resources live within Dhamma Library; there is no separate top-level Dhamma Resources page.
* **Folders become tags, not categories.** Every path segment of an S3 key is a tag, with the leading number removed (`^[0-9၀-၉]+[။.]\s*`) and zero-width characters dropped. `၁၀။ မြန်မာရှား (၁)/၁။ ဝိနိစ္ဆယများ/…` is tagged `မြန်မာရှား (၁)` and `ဝိနိစ္ဆယများ`; `18. Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ` is tagged `Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ`. Folders with the same name after stripping share a tag. Tags display in their original spelling and match on their normalized form.
* **Folder-style browsing plus search.** The landing page has a search box and a folder (tag) tree; each folder is a pre-rendered static page with breadcrumbs and pagination, usable without JavaScript. Tag filter chips narrow search results. Keep query, tag and page state in the URL so links, back/forward and language switching preserve it (locale-switch rule above). Do not collect search queries as analytics.
* **Normalization (build and query share one function):** NFC; remove U+200B, U+200C and U+200D; lowercase; treat ဥ (U+1025) and ဉ (U+1009) as the same letter; treat Burmese digits ၀–၉ and ASCII digits 0–9 as the same; for Latin text only, fold diacritics (`pali` finds `Pāḷi`). Never strip combining marks on Burmese characters. The digit ၀ and the letter ဝ look alike and are **not** folded (open question for Burmese review). "Roman number" in the requirements means ASCII digits, not Roman numerals.
* **Search engine: MiniSearch**, with the index built at build time and loaded lazily on the library page only. Burmese is segmented into syllables with a deterministic syllable regex (not `Intl.Segmenter`, which differs across browsers) and indexed as 1–3 syllable n-grams, so unspaced and half-typed queries work. Query chunks separated by spaces must all match (AND); matches begin at syllable boundaries (so `က` does not match inside `ကျ`) but may end mid-syllable. Searchable text is the title, parenthetical title note, tags and folder-path names.
* **Results and ranking:** exact and prefix matches first, then a labelled **"Similar books"** group from fuzzy matching. Ranking tiers: exact title, title starts with the query, title contains it, then matches only in tags, folder path or note; ties by folder order, then title. Zero-result searches show fuzzy matches and "more in <tag>" suggestions. Show counts, active filters, a reset control and a helpful empty state.
* **Cards** show title, tags (folder path), size, language and a clear Download action. The original S3 filename is never merged into the title (it would clutter titles and reintroduce unsearchable Zawgyi text); when it differs from the displayed title, a card shows it as a small secondary line next to the folder path. Identify that downloads are PDFs and show file size.
* **Performance budget** (confirmed in a prototype before building the UI): serialized index at most about 400 KB gzipped, a query in well under 50 ms on a mid-range phone, results rendered in pages and never all 3,000 at once. If Burmese relevance or the budget fails, reduce n-gram size or fall back to a substring-plus-tiers matcher.
* **Not Phase 1:** audio, video and app resources (curated links only), file-body text search, OCR and transcription (Phase 4), and uploading new files (the Phase 4 pipeline). Curated blog-post links may still be added as library resources through the curated `resources` collection; there is no blog feed.

### Phase 1 library status and decisions (as of 2026-10-03)

* **Built and committed or in review:** normalization, syllable segmentation, record and tag helpers, `libraryFileSchema`, the generator, the manifest (3,009 records from 3,013 S3 objects), Zawgyi detection and conversion, the MiniSearch index with golden tests, the lazy-loaded search page, and the static folder tree and folder pages. **Not started:** the other four pages (Home, About, Privacy, Classes) and the deploy workflow.
* **Measured on the real manifest:** serialized index about 1.1 MB raw and 217 KB gzipped (budget 400 KB), build about 60 ms, load about 20 ms, queries about 0.1 to 3 ms in Node. Not yet measured on a phone.
* **Search decisions made while prototyping:**
  * Only the last term of the last chunk accepts a prefix. An earlier version let every term match as a prefix, so a finished word could extend into a different word.
  * Exact results are ordered by tier, then MiniSearch score, then folder order (a small change from "ties by folder order": score gave better results for broad queries).
  * The "Similar books" group is re-ranked by character-pair (Dice) similarity of query and title, and results below 0.2 are dropped, because MiniSearch's raw score favored long titles that merely contained a fuzzy-matched fragment.
  * A multi-word query typed with no space (for example `ဝိနယပိဋက`) has no exact match when no title contains the whole sequence; it falls back to similar books.
* **Zawgyi filenames (found in the audit):** the legacy encoding appears in about 11 titles. The detector alone is unsafe here (about 140 valid Pāḷi titles score as Zawgyi), so the generator converts only on detector score of at least 0.9 plus an impossible-in-Unicode marker, writes every conversion to `zawgyi-review.json`, and reports suspicious and ambiguous titles without changing them. `myanmar-tools` is pinned to 1.1.3 (1.2.0 on npm ships unbuilt sources). Conversion can be wrong on mixed text, so a Burmese speaker reviews it and corrections go in `overrides.json`.
* **Numbers and sizes:** counts, page numbers and file sizes use `Intl.NumberFormat` with the locale registry's `formatLocale` (`my-MM` for Burmese) but always with Latin digits (`numberingSystem: 'latn'`), so Burmese pages never mix Burmese and Latin digits (decided 2026-10-03). The unit label follows the formatter.
* **Visual design (2026-10-04):** the site uses the Win Metta Brand Kit palette from Canva (near-black ink `#121210`, white, warm sand `#ede7df`/`#e9dfd7`, sky `#d9e8f1`, dusty blue `#bdd2dc`, greys) and the brushed-ink-circle logo (header, favicon, Home hero, language chooser). The Brand Kit has no accent or text-grey that meets contrast, so three colors are derived and recorded in `global.css`. There is no dark mode yet. Fonts: the Brand Kit's font list is only Canva's default serif, so the site keeps the system sans plus Noto Sans Myanmar.
* **Other pages (as of 2026-10-04):** Home, About and Privacy exist in both locales at `/[locale]/`, `/[locale]/about/` and `/[locale]/privacy/`. Their text lives in the keyed message dictionaries (`about…`, `privacy…`, `home…`), so the build fails if a Burmese string is missing. About is a concise original summary of facts from the organization's own docs and links to winmetta.org/about/ for more; a maintainer must check it against that page. Privacy describes only what the site does today (no accounts, advertising, analytics or tracking cookies; searching runs in the browser, but search words, filters and the chosen time zone are written to the page address, so a link that is opened, reloaded or shared sends them to the host and CDN request logs, which the page says; the optional language preference is stored on the device; PDFs come from bunny.net) and carries a last-updated date that must change whenever that behavior does. All Burmese text for these pages needs Burmese-speaker review.
* **Classes group (as of 2026-10-05):** built in both locales from winmetta.org's class, study group, retreat and bio pages. The classes, Sayadaws and retreats are committed JSON (`classes.json`, `teachers.json`, `retreats.json`, `channels.json`, `zoom-help.json`), the Sayadaw and retreat data come from read-only importers (`scripts/import-teachers.mjs`, `scripts/import-retreats.mjs`), and schemas validate them in Vitest. The schedule engine converts each class's source time zone (Pacific, or Arizona for Ashin Kelāsa) to any of 12 zones with daylight saving and day rollover. Retreat session days come from the title or list position, never the WordPress post date, with reviewed overrides. Contact numbers, forms, rosters, chat invites and lay participants' photos are never copied; only monastics' portraits and biographies already published on winmetta.org are committed, sourced in `src/assets/SOURCES.md`. Official YouTube, Facebook and Zoom icons are in `src/assets/brand/` with their brand pages recorded. An upcoming retreat can be added by hand with `"status": "upcoming"`. Source conflicts recorded: Ashin Kelāsa's time, the 11th retreat year, and the 3-day 2025 retreat naming. Burmese terminology: "ဆရာတော်" is reserved for monks, "ဘုန်းကြီးကျောင်း" for a monastery, and common English technical terms stay beside Burmese ones. All new Burmese text and the draft English bios need Burmese-speaker review.
* **Known limitation:** library search assumes Unicode input. A query typed in Zawgyi finds nothing. Supporting it is a future improvement with no scheduled phase or date (tech-architecture.md §10); do not build it in Phase 1.
* **Data cleanup done in S3:** the misspelled `Rear-Buddhist-Books` folders were removed in favor of `Rare-…` (with redirects on the old web pages), the zero-byte `done.txt` markers were deleted, 9 duplicate files were removed, and versioning with a 90-day noncurrent-version expiry was enabled. Two same-size name variants and one Zawgyi-named copy remain and are indexed once.

### Content and design boundaries

* Use [winmetta.org](https://winmetta.org/) as a factual reference with a deliberately small selection of high-level content for About, Classes and Home. The library is the exception: it indexes the whole S3 bucket through the generated manifest. Reference pages include [About](https://winmetta.org/about/), [Burmese classes](https://winmetta.org/sayadaw-u-garudhamma-burmese-class/), [Dhamma resources](https://winmetta.org/dhamma-download/) and the [library directory](https://winmetta.org/dhamma-library/). The homepage, resource directory and library were inspected during planning; About could not be fetched and needs verification during content preparation.
* Write concise original navigation and organizational summaries. Preserve teacher names, titles, source attribution and doctrinal wording; do not rewrite teachings. Link out to existing materials rather than importing the whole site. Library titles are derived from S3 filenames and corrected only through the overrides file; never rename S3 objects to fix a title.
* **No bulk blog import, automatic feed or WordPress content migration. Do not reuse winmetta.org's UI design**, layouts, styling, sidebars or navigation hierarchy. Develop a calm, accessible design for mobile and desktop.
* Store source URLs and a last-verified date with curated class/resource metadata. Generated library records carry the S3 key and last-modified time instead. Verify active schedules and destinations before publication; unresolved items may link to the source page without inventing details.
* Production pages use verified public facts and links. Synthetic data is for fixtures and previews only and must not ship as real class listings. Do not import student information or private meeting credentials. Library files are already public; any new media republication, and the JPTS and rare-book scans before the public launch, require the rights check in the PRD.
* Every page and all shared UI have complete English and Burmese translations. Never fabricate translations of teachings.

### Phase 1 checklist

* [x] Home, About, Privacy, Classes and Dhamma Library built in both locales (every page has an `/en/` and a `/my/` route, plus the root language entry page), with original layouts. **Done:** Home, About, Privacy and the library (with folder pages); the About and Privacy links are in the footer on every page and Home links to the library, About and Privacy. **Also done:** Classes, Study groups, Retreats (at `/classes/retreats/`, an archive of 15 past retreats with search and filters, plus detail pages), Sayadaws (8 bio pages at `/classes/sayadaws/`) and Zoom help, all linked from the header and Home. **Open for maintainers:** verify class times, Zoom IDs and which classes are live-streamed; Burmese-speaker review of new Burmese text and the draft English bios; confirm teachers are comfortable with their portraits in the public repo. **Source conflicts:** Ashin Kelāsa's Sunday class is stored as 2:00–3:00 PM Arizona time (`America/Phoenix`, no daylight saving, per the maintainer), so it equals 2:00 PM Pacific while California is on daylight time and 1:00 PM Pacific after it ends; winmetta.org's list (2:30–3:30) and weekly table (2:00–4:00) disagree with each other; the 11th retreat page says 2023 in one sentence but lists 2024 (list used); the 3-day 2025 retreat page is titled Ashin Kuṇḍadhāna but its English text says Ashin Kovida (title used). **Code and content done; the review and verification moved to the Phase 2 staging review gates.**
* [x] Curated, verified public content: About text and class summaries with Pacific/Myanmar schedules, with source URLs and verification dates. **Code and content done; the review and verification moved to the Phase 2 staging review gates.**
* [x] Library manifest generator (`scripts/generate-library-manifest.mjs`, `npm run library:manifest`): lists the S3 bucket with a read-only AWS profile and writes the committed manifest plus an overrides file; skips zero-byte objects, reports non-PDF files, detects duplicates by normalized path/name/size (for example the 9 under `၉။ ပေမူများ`, now removed from S3), fails on keys that do not round-trip through URL encoding, and sorts output deterministically.
* [x] `libraryFileSchema` and manifest validation in CI (a Vitest test validates the committed manifest: unique ids and keys, every key round-trips into a URL); the build needs no AWS credentials.
* [x] Zawgyi filenames detected and converted by the generator (`myanmar-tools@1.1.3`, converts only on detector score ≥ 0.9 plus an impossible-in-Unicode marker), every conversion listed in `zawgyi-review.json` and reviewed by a Burmese speaker; suspicious and ambiguous titles reported, not changed. **Code done; Burmese-speaker review of the 11 conversions and 3 suspicious titles is pending.** **Code and content done; the review and verification moved to the Phase 2 staging review gates.**
* [x] Shared search normalization (NFC, zero-width removal, ဥ/ဉ, Burmese/ASCII digits, Latin diacritics) and a Myanmar syllable segmentation helper, both unit-tested with real Burmese titles.
* [x] MiniSearch index built at build time and lazily loaded: Burmese n-gram tokenizer, AND of space-separated chunks, syllable-start matching, tiered ranking, labelled "Similar books" fuzzy group, tag suggestions on empty results. **Done:** `lib/library-search.ts` (index, tokenizer, tiered ranking, similar group, tag filter, serialization), the build-time files (`/library-data/index.<hash>.json` and `records.<hash>.json`, content-hashed for CDN caching), and the lazy-loaded search page at `/[locale]/dhamma-library/` (data downloads only on first focus, typing or a shared `?q=` link; URL state; "Similar books" group; folder-name suggestions on empty results; Playwright coverage). The folder tag tree and static folder pages are still to do.
* [x] Tag tree and static folder pages with breadcrumbs, pagination, counts and an empty state. **Done:** `/[locale]/dhamma-library/folders/<id>/` (page 1) and `.../<id>/<n>/`, 61 folders and 96 pages per locale at 50 books per page, the nested folder tree on the library landing page, and `folders.json` for stable ids. All of it works without JavaScript. Search keeps its own folder filter chips and URL state.
* [x] Golden-query suite (Burmese partial words, typos, spaced and unspaced queries, digits, ဥ/ဉ variants) reviewed by a Burmese speaker and run in Vitest against the real manifest; index size and query-time budgets recorded. **Golden tests exist (written by the developer, not yet reviewed by a Burmese speaker).** They name real titles, so regenerating the manifest after a rename or removal in S3 can break one; update the test to a title that still exists and never weaken an assertion (see AGENTS.md). **Code and content done; the review and verification moved to the Phase 2 staging review gates.**
* [x] Replace or remove the Phase 0 smoke page and synthetic fixtures from published content. The smoke page and its React island are gone and Home replaced it; the synthetic fixtures remain only as schema test data and are not read by any page.

Phase 1 is feature-complete when these items are built. Its reviews and the acceptance walkthrough need a real environment and reviewers, so they run on staging in Phase 2 (see "Staging review gates" in §4).

---

## 4. Phase 2 — Infrastructure & Deployment

**Goal:** host the Phase 1 site on AWS and deploy it to **staging** and **production** with infrastructure defined as code (the static site hosting and the CI deploy workflow moved here from Phase 1). Details in [tech-architecture.md](tech-architecture.md) §6–§8.

* [ ] Pulumi (TypeScript) program in `infra/pulumi/` with `staging` and `production` stacks (site buckets with CloudFront, media S3 buckets and IAM, Bunny pull zones, the Route 53 zone and its records). State in a private, versioned S3 bucket (`pulumi login s3://…`) and secrets encrypted with an AWS KMS key, so nothing leaves AWS; only non-secret `Pulumi.<stack>.yaml` is committed. `pulumi preview` runs on PRs touching `infra/` with a read-only role; `pulumi up` is a manual maintainer action.
* [ ] AWS hosting: two private S3 buckets (production and staging) each behind a CloudFront distribution with an ACM certificate, a CI IAM role (GitHub OIDC) scoped to those buckets and distributions, and a wildcard preview host for per-PR previews. Azure is not used for permanent hosting; it may serve occasional workloads only.
* [ ] Domains and DNS (AWS Route 53): a hosted zone for `app.winmetta.org`, delegated from DreamHost with four NS records for `app` added once in the DreamHost DNS panel (confirm DreamHost accepts NS records for a subdomain). Production is `app.winmetta.org` and staging is `staging.app.winmetta.org`, with ACM validation records, the CloudFront aliases, the preview wildcard and `cdn.app.winmetta.org` all in that zone, managed by Pulumi. `winmetta.org` itself, its name servers (DreamHost's free nonprofit hosting requires them) and the WordPress records are unchanged.
* [ ] Media: private AWS S3 buckets for production and staging (separate, public access blocked), served through bunny.net pull zones (the same S3 → bunny.net pattern already used for the Dhamma Library PDFs, with bunny.net also caching the WordPress site today) on `cdn.app.winmetta.org` (proposed) and a staging hostname, with plain CNAME records in the Route 53 zone. Bunny reads via S3 origin authentication using a read-only IAM user; verify per tech-architecture.md §6. Verify public fetches, cache hits, CORS, MIME types and audio/video seeking.
* [ ] CI deploy: `.github/workflows/deploy-web.yml` builds the site and publishes it with `aws s3 sync` plus a CloudFront invalidation; GitHub Actions assumes an IAM role through OIDC, so no long-lived AWS keys are stored. Staging and PR previews send `noindex` and are not linked from winmetta.org. Until the preview host exists, a PR's built site is kept as a workflow artifact.
* [ ] CI/CD promotion: `main` deploys automatically to staging and a deliberate step (tag or manual approval) promotes to production.
* [ ] `noindex` and access restriction on staging and PR previews.
* [ ] Complete the staging review gates below before promoting to production.
* [ ] Smoke-test both environments end to end, document the rollback procedure, and record the runbook for editing content and redeploying.

### Staging review gates (Phase 2, after the first staging deploy)

Reviewers need a real environment, so these run on staging. Production promotion (and the public launch) waits until all three are done.

**Burmese-speaker review**

* [ ] The 11 Zawgyi conversions and 3 suspicious titles in `zawgyi-review.json`, recording corrections in `overrides.json`.
* [ ] The golden-query suite (partial words, typos, spaced and unspaced queries, digits, ဥ/ဉ variants), then record the index size and query-time budgets.
* [ ] All Burmese interface text on the Classes, Dhamma Study Groups, Retreats, Sayadaws and Zoom help pages, the schedule table and the time zone names, and the draft English biographies (set a teacher's English `reviewed` to `true` only after this).

**Class host review**

* [ ] Class times, Zoom IDs and the public passcode, which classes are live-streamed, and the language each class and study group is taught in (including the two study groups).
* [ ] The About text, the retreat details (including the 13th retreat, which has no detail page on winmetta.org) and the Kuṇḍadhāna/Kovida naming on the 3-day 2025 retreat page.
* [ ] The Sayadaws confirm they are comfortable with their portraits and biographies in the public repo.

**Acceptance walkthrough (formerly the Phase 1 acceptance list)**

* All pages work in both locales; direct loads and internal navigation work without login.
* Both journeys work on mobile and desktop: find a class and its joining information; search/browse the library by folder tag, find a book from a partial or misspelled Burmese phrase, and open its PDF.
* Verify Burmese and English search (partial words, typos, spaces, digit and ဥ/ဉ variants), tag filters, empty results, reset, shareable URLs, back/forward, same-page language switching with filters, duplicate S3 copies shown once, and every library link returning the PDF.
* Validate translation coverage, blocked-storage behavior, mobile text wrapping, keyboard navigation, document language metadata and source-link validity.
* Verify Pacific daylight-saving transitions and Myanmar date/day rollover independently of interface language. No analytics, blog feed or copied WordPress design.

Out of scope for Phases 0–2 (future work): interactive LLB lessons, the repeatable upload-and-reindex pipeline for new library files (outlined in §5), full-text/OCR/transcript search inside PDFs, unified class archive, additional locales beyond English/Burmese, product analytics/metric collection, profile timezone preferences, backend API, database, accounts, offline/PWA, `apps/desktop`, `apps/mobile`. Excluded entirely: standalone blog publishing/automatic feeds, copying the existing site UI, bulk website migration.

---

## 5. Phase 4 outline — Library content pipeline

**Goal:** make adding books repeatable. Phase 1 indexes everything already in the S3 bucket; Phase 4 defines how new PDFs get into S3 and into the index and pages without hand-editing HTML. Not started and not scheduled; the detailed workflow and rationale are in [tech-architecture.md](tech-architecture.md) §3 ("Library content pipeline").

* [ ] **Upload helper** (script, write-capable AWS profile, never in CI): uploads into the correct numbered folder and refuses names that need fixing: zero-width characters, non-NFC text, a name that duplicates an indexed file, or a Zawgyi filename (detected with the same two-gate rule the generator uses).
* [ ] **Documented procedure** for maintainers: set up the AWS profile, upload, regenerate, review, open a PR. Versioning (enabled, 90-day noncurrent expiry) is the recovery path for a bad sync; replacing a file also needs a Bunny cache purge for its path.
* [ ] **Regeneration PR:** a manually triggered or scheduled GitHub Actions job using an OIDC role with read-only S3 access (no stored AWS keys) runs `npm run library:manifest` and opens a PR with the manifest diff: added, changed and removed files, the duplicate report, new tags and folders, and `zawgyi-review.json`.
* [ ] **Review checklist in the PR:** Burmese speaker checks new titles, tags and any Zawgyi conversions and records corrections in `overrides.json`; new folders get ids and names in `folders.json`; golden search tests are updated only when a title they name was legitimately removed or renamed.
* [ ] **CI gates:** schema validation, golden queries, and the index size and query-time budgets; merging to `main` deploys.
* [ ] **Separate Phase 4 work:** full-text search inside PDFs, OCR, transcripts, and the unified class archive.

Acceptance: a maintainer who has never touched the repo adds one new PDF following the written procedure, and it is searchable and downloadable after the PR is merged, with no hand edits to listing files.

---

## 6. Reference: Monorepo Configuration

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

## 7. Reference: macOS Setup Script

Shared developer tooling (Homebrew, git, gh, shellcheck, shfmt, nvm, editor, AI CLIs) is installed by `bootstrap-dev-env.sh` in the org [`.github` repo](https://github.com/winmetta/.github#developer-setup). This repo's own `scripts/setup-local-dev.sh` then installs Node from `.nvmrc`, the pinned npm, locked dependencies and the Playwright browser.

---

## 8. Agent & Contributor Docs

[AGENTS.md](../AGENTS.md) is the single source of truth for conventions used by contributors and AI coding agents. It is not duplicated here — read that file rather than a copy in this plan. `CLAUDE.md` is a symlink to it (`ln -s AGENTS.md CLAUDE.md`).
