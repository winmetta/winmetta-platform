# Product Requirements Document (PRD): Win Metta Platform

**Vision:** A living bridge between the Burmese Theravāda tradition and anyone, anywhere, who wants to join online classes, learn the Burmese language, or find authentic Dhamma resources — continuing the work Win Metta's teachers already do every week.

---

## 1. Executive Summary & Problem Statement

Win Metta is an existing California 501(c)(3) public charity. Today, its mission already runs live: multiple Sayadaws (U Garudhamma, Kelāsa, Kuṇḍadhāna, Kumārābhivaṃsa, and others) teach weekly Zoom classes in Abhidhamma, Paṭṭhāna, Pāḷi grammar/Tipiṭaka Pāḷi, and meditation, some of which have run for 100+ consecutive weekly episodes. A serious Dhamma Library already exists — Pāḷi Tipiṭaka, Aṭṭhakathā, Ṭīkā, Nissaya translations, rare Buddhist books, Pāḷi grammar references, and JPTS material. There is additionally a structured Burmese-literacy course — publicly known as **"Let's Learn Burmese" (LLB)** — currently taught by Ven. U Garudhamma, with Grade 1 & 2 books plus a 96-part reading/grammar series. LLB is the name of the course itself, not tied to one teacher — other teachers may join or eventually succeed Ven. U Garudhamma in teaching it.

The problem is not a lack of content or teachers — it's that all of this lives scattered across a WordPress site, YouTube, Facebook, and static PDF downloads, so class students and newcomers alike struggle to find the right class, schedule or resource, and there is no structured, self-paced way to progress outside live class times.

Separately, there is a well-documented and largely unaddressed gap: the Burmese diaspora (an estimated 250,000–320,000 people in the US alone, plus established communities in Singapore, the UK, Australia, and elsewhere) includes many people — of any age — who want to learn to read Burmese script and understand the Buddhist teachings their family follows, but who don't start from zero the way a tourist phrasebook app assumes. Mainstream language apps (Duolingo, Ling, Bluebird Burmese) are not built for this "heritage learner" starting point, and no existing tool combines Burmese literacy with Pāḷi and Buddhist textual study at all.

**Win Metta's platform will first give online class students and independent learners worldwide one clear, bilingual (English and Burmese) place to find classes and Dhamma resources, then digitize the existing, proven curriculum — starting with the "Let's Learn Burmese" (LLB) course, currently taught by Ven. U Garudhamma — into an interactive, self-paced learning experience, and grow the Dhamma Library and class archive into a coherent, searchable structure**, without assuming anyone's starting point in language, geography, or technical comfort.

---

## 2. Target Audience

The platform has **two primary user groups**: students attending online Zoom classes, and anonymous independent learners worldwide seeking Burmese-language and Dhamma (Buddhist teachings) resources. Both groups have equal access without login; neither enrollment nor Burmese heritage is required. The five bilingual pages (Phase 1) serve both from launch (implementation-plan.md §3). Personas are deferred to the future plan (§8).

---

## 3. Core Product Principles

* **Calm by Default:** No pushy notifications, streaks, leaderboards, badges, or infinite scroll.
* **Dāna & Open Access:** Core teachings, the Dhamma Library, and the literacy curriculum remain free and unpaywalled.
* **Mindful Engagement:** Replace likes/follower counts with mindful gestures (*Sādhu / Anumodanā*) and quiet progress tracking, not competitive metrics.
* **Works on Weak Connections:** Pages are lightweight and load fast on slow networks and lower-powered devices within the supported modern-browser baseline (tech-architecture.md §2). Full offline use (downloaded lessons, audio, library files) is a future goal, not a v1 requirement.
* **Mobile and Desktop:** Design and validate responsive layouts for both mobile and desktop, with touch-friendly controls, keyboard navigation, and readable content at each size. Mobile is the expected majority of usage; desktop remains a first-class experience.
* **Two Primary User Groups:** Support online class students and independent learners worldwide. Location, language, and technical comfort are separate preferences, not proxies for a learner's goals.

---

## 4. Feature Specifications

### 4.1. Adaptive Onboarding & Profile-Based UI (Future)

Phases 0–2 use public navigation and a language switcher without onboarding. From the LLB learning experience (Phase 3) onward, the app may ask a short, skippable set of questions rather than assuming one default experience:

* **Learning intent:** Attend online classes, explore resources independently, or both (optional; changeable).
* **Tech comfort:** Tech-fluent or prefers a simpler mode.
* **Interface language:** Mostly Burmese or mostly English (changeable anytime in settings).

These answers adjust, but never lock:

* **Content emphasis on the home screen** — optional learning intent can emphasize classes or independent study without hiding either. Do not infer intent from geography or interface language.
* **Interface density** — a simplified mode (larger text, fewer options, linear navigation) for non-tech-fluent users vs. a standard mode for tech-fluent users.
* **UI copy language** — Burmese-first or English-first labels and navigation.

No account is required to set or use these preferences — they are stored locally by default (see §4.6 on access considerations).

### 4.2. Burmese & Pāḷi Literacy Pipeline (Phase 3)

* Digitize the existing curriculum — **"Let's Learn Burmese" (LLB)**, currently taught by Ven. U Garudhamma: Grade 1 & Grade 2 books plus the 96-part "Learning Grammar by Reading" series — into interactive, self-paced **LLB lessons**: script recognition/tracing drills, audio-linked reading practice (using existing class recordings), and spaced-repetition review — without streaks or competitive pressure.
* Designed with **heritage learners** in mind: LLB should work for someone with partial/passive Burmese knowledge, not only for a true zero-knowledge beginner, which is where mainstream language apps fall short for this audience.
* Progression path extends from Burmese script literacy (LLB) toward Pāḷi, following the same "organize by actual class name" pattern as LLB rather than one generic "Pāḷi track":
  * **PGTP — "Pāḷi Saddā & Tipiṭaka Pāḷi"** (ပါဠိသဒ္ဒါ နှင့် တိပိဋကပါဠိ သင်တန်း): Pāḷi grammar and Tipiṭaka Pāḷi, currently taught by Ven. U Garudhamma — the natural next step after LLB, and the first candidate for digitization once LLB is validated.
  * **Sutta Piṭaka Study** (မူရင်းသုတ္တန်ပိဋကတ်ပါဠိတော်ကို လေ့လာခြင်း သင်တန်း): studying the original Sutta Piṭaka Pāḷi text, currently taught by Ven. Kelāsa — a distinct, more advanced curriculum from PGTP; gets its own short name (not yet assigned) if/when it's digitized, rather than being merged with PGTP just because both involve Pāḷi.
  * As with LLB, each of these is a course identity independent of its current teacher — see the naming note in tech-architecture.md §3.
* Learner progress and review state are kept on the learner's own device (browser storage); no account needed.
* Each LLB lesson can note when a learner may be ready to join the live Zoom class — for v1 this is a simple in-app suggestion, not a data pipeline back to teachers (see §4.7 on deferred monastic tooling).

**Naming note:** "LLB" identifies the **course**, not a teacher — LLB lessons are attributed to whichever teacher currently teaches them (Ven. U Garudhamma today; possibly additional or different teachers later), so the data model should keep "curriculum" (`llb`) and "teacher" as separate fields rather than binding the course name to one person. Avoid the bare generic term "lesson" when referring to this content — as more curricula are added (e.g., the Pāḷi track above, or a distinct course from another teacher), each should get its own short name/prefix the same way, so content from different curricula stays unambiguous.

### 4.3. Dhamma Library & Class Archive

* **Classes and Dhamma Library are the two main page groups**, primarily serving online students and independent learners respectively, with access open to both. Class pages link to relevant library resources.
* **Dhamma Resources is part of Dhamma Library**, not a separate top-level page. The unified library supports books, PDF files, mobile/desktop app URLs, audio, video, images, slides, blog posts and other curated links.
* Phase 1 **indexes every PDF in the existing S3 bucket** (about 3,000 files, mostly Burmese books; already public via winmetta.org). Most visitors type Burmese words and do not know a title or author, so search is **fuzzy** and surfaces similar books, built on MiniSearch with Burmese-aware normalization (ဥ/ဉ and Burmese/ASCII digits treated as equal). Folders become **tags** (number prefix removed; each path segment is a tag) used for folder-style browsing and filtering, with clear filters, empty states and shareable query/tag URLs. Apps, blog links and other non-S3 items stay curated. Details: tech-architecture.md §3.
* Keep subject categories, resource types, file formats and app platforms distinct. A book can have a PDF download, and an app can have mobile/desktop links within one entry. Preserve source language and attribution. Full-text indexing inside PDFs, OCR and transcripts are future work (Phase 4).
* A unified class archive: recordings and descriptions per teacher/series pulled together from YouTube and Facebook into one browsable, searchable timeline (e.g., "Paṭṭhāna course episode 115") so students aren't hunting across three platforms.
* **Link out to, rather than rebuild, existing best-in-class Tipiṭaka reader apps** (e.g., Tipitaka.app, tipitakapali.org) for full canonical-text search — that problem is already well solved.
* **Rights check required before republishing:** confirm copyright/attribution status of JPTS (Journal of the Pali Text Society) material and other rare-book scans; only host what Win Metta has the right to redistribute.

### 4.4. Live Class Directory

* A clean, structured schedule view of current weekly Zoom classes (day/time, teacher bio, Zoom link/passcode) — digitizing what's already on the homepage today. Class Zoom links and passcodes are already public on winmetta.org, so they may appear in this repo's class-schedule content.
* Show each upcoming class in both Pacific time (`America/Los_Angeles`) and Myanmar time (`Asia/Yangon`) by default, including the date/day in each zone. Store the recurring class’s source IANA timezone and local day/time; derive each dated occurrence so Pacific daylight-saving changes and Myanmar day rollovers remain correct. Do not hardcode PST or a fixed offset year-round.
* A profile preference for the displayed timezone is future work; v1 always shows Pacific and Myanmar.
* Plain chronological/day-of-week listing. No feed, no algorithmic ordering.

### 4.5. Internationalization & Content Language

* English (`en`) and Burmese (`my`) are the launch interface languages. Phase 0 builds the localization foundation; Phase 1 delivers translated versions of all five starter pages and shared navigation, with locale-prefixed routes and a same-page language switcher.
* Design for additional languages/locales through a central locale registry, keyed UI messages, localized content records and locale-aware formatting. Interface language, source material language and timezone are separate fields; linked teachings need not exist in every UI language. See implementation-plan.md §2 and tech-architecture.md §5 for fallback and validation rules.

* All Burmese-script content in v1 is **Unicode-only**. Legacy Zawgyi encoding is explicitly out of scope for now (full rationale and the reason Zawgyi support may be needed later is documented in [tech-architecture.md](tech-architecture.md)).

### 4.6. Geographic & Access Considerations

* **Worldwide access:** Class students and independent learners can browse the same resources. Let learners choose their path without requiring location or enrollment information.
* **Low-bandwidth support:** required for both elderly diaspora users and Myanmar's variable connectivity. Target modern browsers on mobile and desktop; legacy browsers below the documented baseline are not a v1 requirement. Offline use is a future enhancement (see tech-architecture.md §10).
* **No login required for core content.** Browsing the library, class directory, and LLB lessons never requires an account. Optional accounts (for saving progress across devices, a future phase) should collect only the minimum data needed and clearly state its purpose. Sign-in through a familiar provider (Google first) is acceptable.

### 4.7. Non-Goals for v1 (Future Plan)

Explicitly deferred, not abandoned:

* **Monastic-facing content management tooling** (self-serve upload/tagging for teachers). v1 content is loaded by a small admin/volunteer team on teachers' behalf. A teacher-facing tool is a future phase once the learner-facing product is validated.
* **Cross-device account sync of LLB lesson progress and library bookmarks** (not "playlists" — that was a feature of an earlier, pre-pivot version of this product). A tentative auth approach is sketched in tech-architecture.md §10 for when Phase 5 arrives.
* **Community submissions & moderated reflections queue.**
* **Native mobile apps** (Electron/Capacitor builds). v1 targets a single responsive web app designed for mobile and desktop; native wrappers are evaluated only after the web app validates real usage.
* **Zawgyi legacy encoding support** — see §4.5 and tech-architecture.md.
* **Product analytics and metric collection** — deferred beyond v1; no analytics scripts or learner-event collection in Phase 0–2. Local progress remains available for the learner.
* **A/B testing / experimentation tooling** — deferred until there's a concrete, mission-aligned question worth testing (not for engagement optimization, which conflicts with Calm by Default). Tentative notes in tech-architecture.md §9 for when it's needed.

---

## 5. Funding & Sustainability Plan

* **Dāna / donations:** Win Metta is a 501(c)(3); tax-deductible donations continue as the base funding model. Core learning content and the Dhamma Library remain free and unpaywalled, consistent with the Dāna & Open Access principle.
* **Grant opportunities specific to this angle** (distinct from — and more viable than — a generic dana-only meditation-app model):
  * Immigrant/refugee community integration and heritage-language preservation grants. Burmese refugees were the largest single refugee-origin group admitted to the US from 2011–2023, which makes Win Metta's literacy mission a plausible fit for state library, refugee-resettlement-agency, and ethnic-community-foundation grant programs.
  * Buddhist and Asian-American cultural preservation foundation grants.
  * International precedent exists for this kind of funding outside the US (e.g., EU Erasmus+-funded minority/heritage-language projects like IndyLan) — worth researching comparable programs in the UK, Australia, and Singapore rather than assuming grants are US-only.
* **Volunteer-driven delivery model:** curriculum digitization, translation/transcription, and much of the initial build will likely rely on volunteer labor from the congregation and diaspora rather than paid staff. Project scope (see Phased Roadmap) should be sized to realistic volunteer capacity, not to a full commercial engineering team's output.
* **Low fixed-cost infrastructure by design:** v1 is a static web app with no server or database to run, so hosting stays cheap and maintenance stays light without earned revenue.
* **Free nonprofit programs first, paid tools when worthwhile:** prefer free services and nonprofit grants (e.g. the Azure for Nonprofits grant). Paying for tooling is fine when it saves volunteer time or reduces risk; donations may fund tech development and maintenance.
* **Popular, well-supported tools:** choose widely used stacks with large communities and good documentation so volunteers can learn them easily and the project stays maintainable for years.
* **Explicitly not pursued:** ads, data-selling, or paywalls on core Dhamma or language content. A possible future option (not part of v1) is earned revenue from physical book publishing/compilations or in-person retreat logistics, noted here only as a future possibility.

---

## 6. Mission-Appropriate Success Metrics (Future)

Metric collection is deferred beyond v1. Do not instrument these outcomes or add an analytics service in Phase 0–2. The following are candidate future measures, not release requirements. Before introducing collection, define feasible measurements, privacy constraints, and denominators; cross-session outcomes cannot be inferred from unrelated aggregate event counts. DAU, session counts, and streaks are not product goals. See tech-architecture.md §4.4. Candidate measures:

* **Literacy progress:** % of learners completing Grade 1 / Grade 2 equivalent LLB lessons; number of learners who reach "can read a short Pāḷi passage in Burmese script unaided."
* **Bridge-to-community rate:** number of self-paced learners who go on to join a live Zoom class (opt-in, self-reported or signup-linked).
* **Return-to-learn rate:** % of learners who return to complete their *next* LLB lesson within a set window (e.g., two weeks) — a gentler signal than daily-streak mechanics.
* **Library reach:** number of distinct rare/archival texts accessed at least once per quarter — measures whether the preservation mission is actually reaching readers, not just hosting files.
* **Teacher-reported signal (qualitative):** occasional check-ins with Sayadaws on whether they observe improved reading ability among app users in live class — collected by conversation, not instrumentation.

---

## 7. Phased Roadmap

```
+---------------------------------------------------------------------------------------+
| Phase 0: Foundation Code                                                               |
| Basic Astro app with all libraries and English/Burmese support; no pages, no deploy    |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 1: Five Bilingual Pages                                                          |
| Home, About, Privacy, Classes, Dhamma Library (S3 index, fuzzy search); en + my        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 2: Infrastructure & Deployment                                                   |
| Terraform, domains, AWS S3 + bunny.net CDN; staging and production, public launch      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 3: Let's Learn Burmese (LLB) Pilot                                               |
| Digitize the LLB curriculum; adaptive onboarding; local progress                       |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 4: Library & Class Archive Expansion                                             |
| S3 upload and index pipeline, class archive, full-text/OCR search, more content        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 5: Optional Accounts & Progress Sync                                             |
| Opt-in accounts, cross-device progress; likely first backend and database              |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 6: Future Plan                                                                   |
| Monastic content tooling, community reflections, native apps, more curricula           |
+---------------------------------------------------------------------------------------+
```

* **Phase 0 — Foundation Code:** Public MIT-licensed repo, tooling, basic CI, and an Astro app with all needed libraries and English/Burmese localization support. No real pages or content and no deployment. See implementation-plan.md §2.
* **Phase 1 — Five Bilingual Pages:** Home, About, Privacy, Classes and Dhamma Library (the whole S3 PDF library with tag browsing and fuzzy Burmese search) in English and Burmese, with an original mobile/desktop design, serving online class students and independent learners worldwide. Adds the CI deploy workflow to a single non-public review app. See implementation-plan.md §3.
* **Phase 2 — Infrastructure & Deployment:** Terraform, domains (`app.winmetta.org`), Azure, AWS S3 media storage with bunny.net CDN, Cloudflare DNS, and staging and production environments with promotion. The site becomes public here. See implementation-plan.md §4. No backend or database.
* **Phase 3 — LLB Pilot:** The flagship learning deliverable. Digitizes the LLB curriculum, proven and already-tested; piloted directly with the existing "Let's Learn Burmese" class roster (currently taught by Ven. U Garudhamma) before wider release.
* **Phase 4 — Library & Class Archive Expansion:** Defines the repeatable pipeline for adding PDFs to S3 and refreshing the index and pages (generator, review PR, CI checks, deploy; see tech-architecture.md §3), plus a unified class timeline and deeper content indexing (full-text, OCR, transcripts) when needed.
* **Phase 5 — Optional Accounts & Progress Sync:** Cross-device sync for learners who want it, opt-in only. This is likely where a backend and database are first introduced (tentative; see tech-architecture.md §10).
* **Phase 6 — Future Plan:** Monastic-facing content tools, community submissions/moderation, native mobile apps, and further curricula beyond LLB (e.g. PGTP, the natural next step, may be pulled forward once LLB is validated — plans can change).

---

## 8. Future Plan: Personas & Adaptive Experience

*Deferred; revisit when the adaptive experience (§4.1) is designed. Not a Phase 0–2 requirement.*

* **Principle — Meet Learners Where They Are:** The same platform must serve a tech-fluent diaspora teenager and a non-tech-fluent elder in Myanmar equally well — via adaptive onboarding, not a one-size-fits-all interface.
* **Personas** illustrating needs within the two primary user groups (they don't restrict who the platform is for):
  1. **The Heritage Reconnector:** Burmese-heritage, English (or another local language) dominant, wants to learn to read and write Burmese and understand the Buddhist teachings their family practices. May have passive/spoken Burmese already — not a zero-knowledge beginner.
  2. **The Committed Dhamma Student:** Already literate in Burmese (Myanmar-based or diaspora), wants structured, self-paced progress through Pāḷi grammar, Abhidhamma, and Tipiṭaka study between weekly live classes.
  3. **The Practicing Elder:** An existing Zoom class attendee (first-generation immigrant or Myanmar-based) who wants easier access to the recordings and materials from classes they already attend, instead of hunting across YouTube, Facebook, and PDF folders.
  4. **The Curious Newcomer:** Someone without Burmese heritage drawn to Theravāda teaching through Win Metta's public content. Part of the primary independent-learner audience; resource discovery must work without assumed heritage or prior familiarity.
