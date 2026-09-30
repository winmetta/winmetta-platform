# Product Requirements Document (PRD): Win Metta Platform

**Vision:** A living bridge between the Burmese Theravāda tradition and anyone — in Myanmar or scattered across the diaspora — who wants to learn the Burmese language, study Pāḷi, and access authentic Dhamma teaching, continuing the work Win Metta's teachers already do every week.

---

## 1. Executive Summary & Problem Statement

Win Metta is an existing California 501(c)(3) public charity. Today, its mission already runs live: multiple Sayadaws (U Garudhamma, Kelāsa, Kuṇḍadhāna, Kumārābhivaṃsa, and others) teach weekly Zoom classes in Abhidhamma, Paṭṭhāna, Pāḷi grammar/Tipiṭaka Pāḷi, and meditation, some of which have run for 100+ consecutive weekly episodes. A serious Dhamma Library already exists — Pāḷi Tipiṭaka, Aṭṭhakathā, Ṭīkā, Nissaya translations, rare Buddhist books, Pāḷi grammar references, and JPTS material. There is additionally a structured Burmese-literacy course — publicly known as **"Let's Learn Burmese" (LLB)** — currently taught by Ven. U Garudhamma, with Grade 1 & 2 books plus a 96-part reading/grammar series. LLB is the name of the course itself, not tied to one teacher — other teachers may join or eventually succeed Ven. U Garudhamma in teaching it.

The problem is not a lack of content or teachers — it's that all of this lives scattered across a WordPress site, YouTube, Facebook, and static PDF downloads, with no structured, self-paced way for a learner to progress through it outside the live class times.

Separately, there is a well-documented and largely unaddressed gap: the Burmese diaspora (an estimated 250,000–320,000 people in the US alone, plus established communities in Singapore, the UK, Australia, and elsewhere) includes many people — of any age — who want to learn to read Burmese script and understand the Buddhist teachings their family follows, but who don't start from zero the way a tourist phrasebook app assumes. Mainstream language apps (Duolingo, Ling, Bluebird Burmese) are not built for this "heritage learner" starting point, and no existing tool combines Burmese literacy with Pāḷi and Buddhist textual study at all.

**Win Metta's platform will digitize the existing, proven curriculum — starting with the "Let's Learn Burmese" (LLB) course, currently taught by Ven. U Garudhamma — into an interactive, self-paced learning experience, and reorganize the existing Dhamma Library and class archive into a coherent, searchable structure**, serving both Myanmar-based and diaspora audiences without assuming either one's starting point in language, geography, or technical comfort.

---

## 2. Target Audience & Core Personas

The target audience is **anyone who wants to learn Burmese, Pāḷi, or Buddhist teachings** — not a specific age group. Named personas:

1. **The Heritage Reconnector:** Burmese-heritage, English (or another local language) dominant, wants to learn to read and write Burmese and understand the Buddhist teachings their family practices. May have passive/spoken Burmese already — not a zero-knowledge beginner.
2. **The Committed Dhamma Student:** Already literate in Burmese (Myanmar-based or diaspora), wants structured, self-paced progress through Pāḷi grammar, Abhidhamma, and Tipiṭaka study between weekly live classes.
3. **The Practicing Elder:** An existing Zoom class attendee (first-generation immigrant or Myanmar-based) who wants easier access to the recordings and materials from classes they already attend, instead of hunting across YouTube, Facebook, and PDF folders.
4. **The Curious Newcomer** (secondary, not a v1 priority): Someone without Burmese heritage drawn to Theravāda teaching through Win Metta's public content. Not excluded — Win Metta's own mission states its teachings are "accessible to everyone" — but not the primary design target for v1.

---

## 3. Core Product Principles

* **Calm by Default:** No pushy notifications, streaks, leaderboards, badges, or infinite scroll.
* **Dāna & Open Access:** Core teachings, the Dhamma Library, and the literacy curriculum remain free and unpaywalled.
* **Mindful Engagement:** Replace likes/follower counts with mindful gestures (*Sādhu / Anumodanā*) and quiet progress tracking, not competitive metrics.
* **Works on Weak Connections:** Pages are lightweight and load fast on older devices and slow networks. Full offline use (downloaded lessons, audio, library files) is a future goal, not a v1 requirement.
* **Meet Learners Where They Are:** The same platform must serve a tech-fluent diaspora teenager and a non-tech-fluent elder in Myanmar equally well — via adaptive onboarding, not a one-size-fits-all interface.
* **Two Audiences, Two Geographies:** Myanmar-based users and diaspora users have different starting points and different needs. The product should serve both without collapsing them into identical experiences.

---

## 4. Feature Specifications

### 4.1. Adaptive Onboarding & Profile-Based UI

On first use, the app asks a short, skippable set of questions rather than assuming one default experience:

* **Location context:** Myanmar-based or diaspora (broad choice, not precise geolocation — never required).
* **Tech comfort:** Tech-fluent or prefers a simpler mode.
* **Interface language:** Mostly Burmese or mostly English (changeable anytime in settings).

These answers adjust, but never lock:

* **Content emphasis on the home screen** — diaspora profiles surface the Burmese/Pāḷi literacy pipeline first; Myanmar-based profiles surface the Dhamma Library and class archive first (see §4.5, Myanmar-based users are typically already Burmese-literate).
* **Interface density** — a simplified mode (larger text, fewer options, linear navigation) for non-tech-fluent users vs. a standard mode for tech-fluent users.
* **UI copy language** — Burmese-first or English-first labels and navigation.

No account is required to set or use these preferences — they are stored locally by default (see §4.6 on access considerations).

### 4.2. Burmese & Pāḷi Literacy Pipeline (Flagship v1)

* Digitize the existing curriculum — **"Let's Learn Burmese" (LLB)**, currently taught by Ven. U Garudhamma: Grade 1 & Grade 2 books plus the 96-part "Learning Grammar by Reading" series — into interactive, self-paced **LLB lessons**: script recognition/tracing drills, audio-linked reading practice (using existing class recordings), and spaced-repetition review — without streaks or competitive pressure.
* Designed for **heritage learners** first: LLB should work for someone with partial/passive Burmese knowledge, not only for a true zero-knowledge beginner, which is where mainstream language apps fall short for this audience.
* Progression path extends from Burmese script literacy (LLB) toward Pāḷi, following the same "organize by actual class name" pattern as LLB rather than one generic "Pāḷi track":
  * **PGTP — "Pāḷi Saddā & Tipiṭaka Pāḷi"** (ပါဠိသဒ္ဒါ နှင့် တိပိဋကပါဠိ သင်တန်း): Pāḷi grammar and Tipiṭaka Pāḷi, currently taught by Ven. U Garudhamma — the natural next step after LLB, and the first candidate for digitization once LLB is validated.
  * **Sutta Piṭaka Study** (မူရင်းသုတ္တန်ပိဋကတ်ပါဠိတော်ကို လေ့လာခြင်း သင်တန်း): studying the original Sutta Piṭaka Pāḷi text, currently taught by Ven. Kelāsa — a distinct, more advanced curriculum from PGTP; gets its own short name (not yet assigned) if/when it's digitized, rather than being merged with PGTP just because both involve Pāḷi.
  * As with LLB, each of these is a course identity independent of its current teacher — see the naming note in tech-architecture.md §3.
* Learner progress and review state are kept on the learner's own device (browser storage) in v1; no account needed.
* Each LLB lesson can note when a learner may be ready to join the live Zoom class — for v1 this is a simple in-app suggestion, not a data pipeline back to teachers (see §4.7 on deferred monastic tooling).

**Naming note:** "LLB" identifies the **course**, not a teacher — LLB lessons are attributed to whichever teacher currently teaches them (Ven. U Garudhamma today; possibly additional or different teachers later), so the data model should keep "curriculum" (`llb`) and "teacher" as separate fields rather than binding the course name to one person. Avoid the bare generic term "lesson" when referring to this content — as more curricula are added (e.g., the Pāḷi track above, or a distinct course from another teacher), each should get its own short name/prefix the same way, so content from different curricula stays unambiguous.

### 4.3. Dhamma Library & Class Archive (Reorganized)

* A structured, searchable version of the existing PDF library (Tipiṭaka, Aṭṭhakathā, Ṭīkā, Nissaya, rare books, Pāḷi grammar references) organized by category, teacher, and topic — replacing the current raw folder listing.
* A unified class archive: recordings and descriptions per teacher/series pulled together from YouTube and Facebook into one browsable, searchable timeline (e.g., "Paṭṭhāna course episode 115") so students aren't hunting across three platforms.
* **Link out to, rather than rebuild, existing best-in-class Tipiṭaka reader apps** (e.g., Tipitaka.app, tipitakapali.org) for full canonical-text search — that problem is already well solved.
* **Rights check required before republishing:** confirm copyright/attribution status of JPTS (Journal of the Pali Text Society) material and other rare-book scans; only host what Win Metta has the right to redistribute.

### 4.4. Live Class Directory

* A clean, structured schedule view of current weekly Zoom classes (day/time, teacher bio, Zoom link/passcode) — digitizing what's already on the homepage today. Class Zoom links and passcodes are already public on winmetta.org, so they may appear in this repo's class-schedule content.
* Plain chronological/day-of-week listing. No feed, no algorithmic ordering.

### 4.5. Content Language & Script Handling

* All Burmese-script content in v1 is **Unicode-only**. Legacy Zawgyi encoding is explicitly out of scope for now (full rationale and the reason Zawgyi support may be needed later is documented in [tech-architecture.md](tech-architecture.md)).

### 4.6. Geographic & Access Considerations

* **Different value emphasis, same platform:** Myanmar-based users (typically already Burmese-literate) get the most value from the Dhamma Library and class archive; diaspora users get the most value from the literacy pipeline first. The onboarding profile (§4.1) routes each toward what's most relevant without hiding the rest.
* **Low-bandwidth, older-device support:** required for both elderly diaspora users and Myanmar's variable connectivity — not a nice-to-have. Offline use is a future enhancement (see tech-architecture.md §10).
* **No login required for core content.** Browsing the library, class directory, and LLB lessons never requires an account. Optional accounts (for saving progress across devices, a future phase) should collect only the minimum data needed and clearly state its purpose. Sign-in through a familiar provider (Google first) is acceptable.

### 4.7. Non-Goals for v1 (Future Plan)

Explicitly deferred, not abandoned:

* **Monastic-facing content management tooling** (self-serve upload/tagging for teachers). v1 content is loaded by a small admin/volunteer team on teachers' behalf. A teacher-facing tool is a future phase once the learner-facing product is validated.
* **Cross-device account sync of LLB lesson progress and library bookmarks** (not "playlists" — that was a feature of an earlier, pre-pivot version of this product). A tentative auth approach is sketched in tech-architecture.md §10 for when Phase 3 arrives.
* **Community submissions & moderated reflections queue.**
* **Native mobile apps** (Electron/Capacitor builds). v1 targets a single mobile-responsive web app; native wrappers are evaluated only after the web app validates real usage.
* **Zawgyi legacy encoding support** — see §4.5 and tech-architecture.md.
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

## 6. Mission-Appropriate Success Metrics

Deliberately not DAU, session count, or streaks — those conflict with the Calm by Default principle. Instead, measure mission outcomes using **anonymous, aggregate analytics collected from all users** (no cookies, no user identifiers, no personal data; see tech-architecture.md §4.4). We want to know what learners do, not who they are. Metrics:

* **Literacy progress:** % of learners completing Grade 1 / Grade 2 equivalent LLB lessons; number of learners who reach "can read a short Pāḷi passage in Burmese script unaided."
* **Bridge-to-community rate:** number of self-paced learners who go on to join a live Zoom class (opt-in, self-reported or signup-linked).
* **Return-to-learn rate:** % of learners who return to complete their *next* LLB lesson within a set window (e.g., two weeks) — a gentler signal than daily-streak mechanics.
* **Library reach:** number of distinct rare/archival texts accessed at least once per quarter — measures whether the preservation mission is actually reaching readers, not just hosting files.
* **Teacher-reported signal (qualitative):** occasional check-ins with Sayadaws on whether they observe improved reading ability among app users in live class — collected by conversation, not instrumentation.

---

## 7. Phased Roadmap

```
+---------------------------------------------------------------------------------------+
| Phase 0: Foundations                                                                   |
| Minimal tooling for a single web app; no premature multi-platform build                |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 1: Let's Learn Burmese (LLB) Pilot (Flagship)                                    |
| Digitize the LLB curriculum (currently Ven. U Garudhamma), adaptive onboarding, Unicode-only web app |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 2: Dhamma Library & Class Archive                                                |
| Structured library, unified class recording archive, no accounts required              |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 3: Optional Accounts & Progress Sync                                             |
| Opt-in accounts, cross-device progress, still dana-based                               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| Phase 4: Future Plan                                                                    |
| Monastic content tooling, community reflections, native mobile apps, more curricula   |
+---------------------------------------------------------------------------------------+
```

* **Phase 0 — Foundations:** Public MIT-licensed repo, monorepo tooling, CI, and a deployed static Astro site at `app.winmetta.org`. Detailed in phase-0-plan.md. No backend or database.
* **Phase 1 — LLB Pilot:** The flagship deliverable. Digitizes the LLB curriculum, proven and already-tested; piloted directly with the existing "Let's Learn Burmese" class roster (currently taught by Ven. U Garudhamma) before wider release.
* **Phase 2 — Dhamma Library & Class Archive:** Reorganizes existing content into a searchable, structured library and class timeline.
* **Phase 3 — Optional Accounts & Progress Sync:** Cross-device sync for learners who want it, opt-in only. This is likely where a backend and database are first introduced (tentative; see tech-architecture.md §10).
* **Phase 4 — Future Plan:** Monastic-facing content tools, community submissions/moderation, native mobile apps, and further curricula beyond LLB (e.g. PGTP, the natural next step, may be pulled forward once LLB is validated — plans can change).
