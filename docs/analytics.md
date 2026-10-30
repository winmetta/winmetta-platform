# Analytics (Phase 4): privacy-first activity measurement

**Status:** planned 2026-10-26. Nothing in this document is built yet. Phases 0–3 collect no analytics and the Privacy page still says so; it changes only when the code ships (stage 4 in [implementation-plan.md](implementation-plan.md) §5A). Until then, [prd.md](prd.md) §4.7 and [tech-architecture.md](tech-architecture.md) §4.4 describe what is live.

**Why:** the site is public and Win Metta has no view of what helps learners: which classes and retreats people look up, whether the library search finds books, whether Burmese and Chinese readers use their language. Measurement should answer those questions without identifying anyone.

---

## 1. Decisions

| Decision | Choice | Notes |
| --- | --- | --- |
| Identity model | **Cookieless, aggregate only** | No cookie, no localStorage, no fingerprinting script, no persistent visitor ID. Decided 2026-10-26. |
| Tool | **Umami, self-hosted** | MIT license, light to run (Node.js + PostgreSQL), custom events, no cookies by default. |
| Hosting | One **AWS Lightsail** VM in the existing AWS account, defined in Pulumi, with PostgreSQL on the same VM | Host `stats.app.winmetta.org`, a record in the existing `app.winmetta.org` Route 53 zone (no new zone). Decided 2026-10-26; alternatives in section 5. |
| HTTPS | **Caddy** on the instance, Let's Encrypt | Not an Application Load Balancer (about $16 a month, more than the server) and not nginx + certbot (same result, more parts). |
| Scope | `winmetta-platform` only | The retreat apps and `learn_burmese` are out of scope. |

### What cookieless means for the questions we can answer

Umami derives a visitor hash from the site, IP address, user agent and a rotating salt, and stores no ID in the browser. With the salt rotated daily, the same person on two different days looks like two visitors. So:

* **We can answer:** page views, unique visitors per day, which pages, classes, library folders, books (downloads), posts, tags and languages are used, which interface and reading languages, referrers, countries and device types, how many searches return nothing, and trends of all of these over weeks and months.
* **We cannot answer:** whether the same person came back next week, a single person's journey across days, or per-learner retention. The candidate measures in [prd.md](prd.md) §6 that need this (return-to-learn, bridge-to-community) stay unmeasured on the server. If a learner-progress feature is built later, progress stays **on the learner's own device** (IndexedDB, [tech-architecture.md](tech-architecture.md) §4.3), not sent to us.
* **Not decided, and not built:** an opt-in "recognize me across visits" ID (a random UUID kept in the browser only after the visitor agrees, passed to Umami as a distinct ID). It would add a consent banner, change the Privacy promise and need a legal check, so it is a separate decision for a later phase if per-visitor continuity is ever needed.

## 2. Tools considered

Vendor facts below come from 2026 third-party comparisons and vendor pages; verify prices and defaults on the vendor's site before relying on them (checked 2026-10-26).

| Tool | Type | Cross-day identity | Operations | Verdict |
| --- | --- | --- | --- | --- |
| **Umami** | Open source (MIT), self-host or cloud (free tier about 100K events a month; Pro from about $20 a month) | None by default; optional customer-supplied distinct ID | Node.js + PostgreSQL | **Chosen.** Light, permissive license, custom events and funnels, same features self-hosted or cloud. |
| Plausible | Open source (AGPL) or cloud from about $9 a month | None by design (daily salt) | Self-host needs PostgreSQL + ClickHouse; Community Edition lacks some features | Good and simpler dashboards, but heavier to host and no free cloud tier. Fallback if Umami disappoints. |
| Matomo | Open source (GPL), self-host free, cloud from about $26 a month | Cookie-based or configurable | PHP + MySQL | Closest to Google Analytics; larger, and some features are paid plugins. More than we need. |
| PostHog | Open source (MIT), cloud with a free tier (about 1M events a month) | `memory` mode or server-side daily hash; `identify()` turns IDs into personal data | Self-hosting wants roughly 16 GB RAM | Product-analytics suite (replay, flags); overkill, and its strengths conflict with our principles. |
| Cloudflare Web Analytics | Free hosted | None | None | No custom events, so it cannot answer the questions above. |
| Fathom, Simple Analytics | Paid hosted (about $15–20 a month and up) | None | None | Fine privacy, but closed source and a recurring cost for what Umami does free. |
| Mixpanel, Amplitude | Paid hosted (free tiers about 1–2M events) | Persistent user IDs | None | User-level tracking conflicts with the mission; not considered further. |
| Google Analytics | Free hosted | Cookies, Google profiles | None | Rejected: data goes to an advertising company. |

Cloud option for Umami (Hobby/Pro) remains a fallback if self-hosting stops being practical; moving between self-hosted and cloud does not change the tracker or events.

## 3. What we collect

Every event is a **name plus non-identifying properties**. Nothing the visitor types and nothing that identifies a person is ever sent.

| Area | Events (name: properties) |
| --- | --- |
| All pages | Automatic page view: path, referrer, interface locale (`en`, `my`) |
| Library | `library_search`: result count bucket only (never the query text); `library_tag_filter`: folder id; `library_folder_open`: folder id; `library_pdf_download`: book id |
| Dhamma Posts | `post_open`: post id; `post_language_change`: chosen set (for example `my,en`); `post_filter`: tag slug; `post_search`: result count bucket only; `post_share`, `post_print`: post id |
| Classes and retreats | `class_zoom_join_click`: class id; `class_timezone_view`: none; `retreat_view`, `retreat_archive_open`: retreat id |
| General | `locale_switch`: from and to; `outbound_click`: destination domain only |

Rules for this table: add an event only with a question it answers; no free-text properties; counts are bucketed (0, 1–5, 6–20, more) so a rare query cannot be recognized; changes to the table are made here first, in a PR.

### Never collected

Names, email addresses, IP addresses stored in readable form, search or form text, Zoom IDs or passcodes a visitor types, precise location, device fingerprints, cookies, localStorage values, session replays, heatmaps, and any ID that survives past the daily salt. No advertising or third-party scripts. Nothing is shared or sold. Do Not Track is honored.

## 4. Privacy requirements

1. **No device storage.** The tracker must write no cookie and no localStorage or sessionStorage key. This keeps us outside the consent requirement of ePrivacy Article 5(3) and avoids a cookie banner. Verified in the browser's storage panel before launch and after any Umami upgrade.
2. **Daily salt rotation.** Sources disagree on Umami's default (daily or monthly). Set it explicitly to daily and test it; a longer salt would let the same IP and browser be linked for weeks.
3. **First-party only.** The tracker script and the data both live on `stats.app.winmetta.org`, and the data is used only by Win Metta.
4. **URLs without search words.** The library and posts keep the search in `?q=`. The tracker must report the path without query strings (`data-exclude-search="true"`), so search words never reach analytics. This also closes the gap the Privacy page already warns about for CDN logs.
5. **Retention.** Keep raw events at most 13 months, then delete (decided 2026-10-29).
6. **Honest wording.** Update the Privacy page (English and Burmese, with the "last updated" date) in the same PR that ships the tracker, saying what is counted and what is not. Draft wording, and the rule that the Burmese must match the English in meaning with some terms intentionally left in English, are in section 8.
7. **Private dashboard.** The dashboard has logins for authorized maintainers only; there is no public or shared read-only link (decided 2026-10-29).
8. **Not a metric goal.** No streaks, DAU targets, rankings or engagement scores ([prd.md](prd.md) §3); this data is read by humans to improve content and fix problems.

## 5. Architecture

```
Visitor's browser (app.winmetta.org)
   | loads script.js and sends events (no cookie, no storage)
   v
stats.app.winmetta.org (Route 53 record in the app.winmetta.org zone, static IP)
   |
   v
One Lightsail VM (1-2 GB RAM, Linux, static IP attached)
   - Caddy: HTTPS with Let's Encrypt, ports 80 and 443 only, reverse proxy
   - Umami (Node.js) on localhost
   - PostgreSQL on localhost or the container network
```

* Defined in Pulumi under `infra/pulumi`, reviewed with `pulumi preview`; **`pulumi up` is a manual maintainer step and needs explicit confirmation** (cloud write).
* Secrets (Umami app secret, database password, admin password) are set with `pulumi config set --secret` or come from the environment, never committed.
* Region: `us-east-1` (N. Virginia, the same region as the site) for the VM, snapshots and backup bucket (decided 2026-10-29).
* Lightsail specifics: pick a plan with at least 1 GB RAM (512 MB is too tight for Umami plus PostgreSQL; 2 GB if the database grows); attach a Lightsail static IP; open only ports 80 and 443 (and SSH restricted to maintainers, or use the browser SSH and keep port 22 closed otherwise) in the Lightsail firewall; enable automatic snapshots as a second, whole-machine recovery path.
* Backups: nightly `pg_dump` to a private S3 bucket with a lifecycle rule (a snapshot alone is not enough); restore is rehearsed once and written in the runbook.
* Updates: pin the Umami image or version, upgrade monthly, apply OS security updates (unattended upgrades), record in the runbook.
* Estimated cost (rough, from memory of AWS pricing; verify before building): about $10–15 a month, or $120–180 a year: Lightsail VM about $7–12, static IP free while attached, backups under $1, Route 53 record and Let's Encrypt $0, data transfer negligible. Plus a small amount of maintenance time each month for updates and backup checks.
* If a CloudFront cache or DDoS cushion is wanted later, put it in front of the instance; not needed at launch.
* An ad blocker will hide some visitors, so counts are a floor, not a census. Proxying the script through the main domain is a later option.

### Hosting alternatives considered (2026-10-26)

| Option | Rough monthly cost | Why not now |
| --- | --- | --- |
| **Lightsail VM, Postgres on the same VM (chosen)** | $10–15 | Cheapest, simplest, stays in the AWS account that already holds the site. |
| Lightsail or EC2 + Amazon RDS PostgreSQL | $20–25 | About double the cost for managed backups and patching; analytics data is small and easy to rebuild, so nightly dumps are enough. A reasonable upgrade later by changing the database URL. |
| Azure Container Apps + Azure Database for PostgreSQL (nonprofit grant) | $25–35, paid from the grant | The grant does not roll over and must be renewed yearly, and a second cloud adds credentials, a Pulumi provider and OIDC to maintain. Container Apps has built-in HTTPS, so no load balancer would be needed. Fallback if AWS spend becomes a concern. |
| Umami Cloud (free Hobby, Pro about $20) | $0–20 | No server to own; data lives with the vendor. Fallback if self-hosting stops being practical. |
| Application load balancer in front of any option | +$16 or more | Not needed for one VM; Caddy terminates HTTPS. |

## 6. Decisions

Decided 2026-10-29:

* **No public dashboard.** Numbers are visible only to authorized maintainers who have a login.
* **Retention:** raw events are kept at most 13 months, then deleted.
* **AWS region:** `us-east-1`, the same region as the site and the Pulumi state, so the same AWS provider covers the Lightsail VM, its snapshots and the S3 backup bucket. Route 53 is global. Changed from `us-west-2` on 2026-10-29 for simplicity.
* **Opt-in returning-visitor ID:** not now; it may be added in a future phase if a real need appears (section 1). It would need its own decision, a consent banner, a Privacy page change and a new legal check.
* **Legal review: done, low risk accepted.** See section 7.

How Win Metta is organized or run (who maintains the server, who administers what) is not published in this repository. Docs describe the system and its rules, not people or roles.

## 7. Legal review (completed 2026-10-29)

Review of the design, with the residual risks accepted as low. This is our own reading, not legal advice.

1. **Consent for device access (EU/UK ePrivacy, Article 5(3)):** applies only when information is stored on or read from the visitor's device. The design stores nothing and reads nothing from the device, so no consent or cookie banner is required. Kept true by checking storage before launch and after every Umami upgrade (section 4.1).
2. **GDPR and UK GDPR:** the daily hash is built from IP address, user agent and a salt, and regulators may treat an IP-derived value as personal data while the salt exists. Accepted position: legitimate interest (Article 6(1)(f)) for running the site; raw IPs are not stored; the salt rotates daily so a value cannot be linked across days or back to a person.
3. **Transparency:** the Privacy page, in English and Burmese, states what is counted and why, the daily hash, the 13-month retention and a contact (`contact@winmetta.org`), changing in the same PR as the tracker (section 8).
4. **Objection:** Do Not Track is honored. No separate opt-out page, because it would itself need storage.
5. **Retention:** 13 months for raw events (decided).
6. **Processor and region:** the data stays in Win Metta's own AWS account in `us-east-1`; AWS is the only processor and no analytics company receives the data.
7. **California (CCPA/CPRA):** no sale or sharing, no advertising use, nothing linked to a person.
8. **Myanmar and other countries:** counts are aggregate and non-identifying, so exposure is low.
9. **If an opt-in visitor ID is added later:** consent comes before anything is stored, with a way to withdraw, and this review is repeated.

## 8. Privacy page wording (draft for stage 4)

Drafts only. The live Privacy page keeps saying "no analytics" until the tracker ships (implementation-plan.md §5A, stage 4). Before publishing, check each statement is true of the running system (no IP stored, daily salt, 13-month deletion, storage empty).

> **Translation rule.** The Burmese Privacy text must mean exactly the same as the English text. Some terms are deliberately left in English (for example Umami, analytics, server, IP, hash, cookie, Do Not Track) because a Burmese rendering risks changing the meaning, or the Burmese word is not settled or not widely understood. Do not "fix" these by translating them. If the two versions ever differ in meaning, the English wording is checked first and the Burmese is corrected to match. Use the same Burmese nouns the site already uses elsewhere (for example for classes and retreats in `apps/web/src/i18n/messages/my.json`). A Burmese speaker reviews the final text before release.

**Replacement for `privacyNone`** (the first sentence changes; the rest stays):

* English: "This site has no accounts, no advertising and no tracking cookies, and it does not use analytics that identify you. It only counts visits anonymously (see \"Anonymous visit counts\" below). Searching and filtering happen in your browser, and typing a search does not send it to us. See \"Search words in the page address\" below for one exception."
* Burmese: "ဤဆိုက်တွင် အကောင့်၊ ကြော်ငြာနှင့် ခြေရာခံ ကွတ်ကီး (cookie) များ မရှိပါ။ သင့်ကို ခွဲခြားမှတ်သားနိုင်သည့် analytics ကိုလည်း မသုံးပါ။ လာရောက်မှုများကို အမည်မဖော်ဘဲသာ ရေတွက်ပါသည် (အောက်ပါ \"အမည်မဖော်သော လာရောက်မှု ရေတွက်ခြင်း\" ကို ကြည့်ပါ)။ ရှာဖွေခြင်းနှင့် စစ်ထုတ်ခြင်းကို သင့်ဘရောက်ဇာထဲတွင်ပင် လုပ်ဆောင်ပြီး ရိုက်ထည့်သော ရှာဖွေစကားလုံးများကို ကျွန်ုပ်တို့ထံ ပို့ခြင်း မရှိပါ။ ခြွင်းချက်တစ်ခုအတွက် အောက်ပါ \"စာမျက်နှာလိပ်စာထဲရှိ ရှာဖွေစကားလုံးများ\" ကို ကြည့်ပါ။"

**New section `privacyAnalyticsTitle` and `privacyAnalytics`:**

* English title: "Anonymous visit counts"
* English: "We count visits so that we can see which pages, classes, retreats, library folders, books and Dhamma posts are used, and in which languages. We use Umami, software that we run ourselves on our own server (hosted with Amazon Web Services in the United States), so no analytics company receives this data. The counting uses no cookies and stores nothing on your device. It does not collect your name, e-mail address, the words you search for, or anything you type. Your IP address is not stored. It is only used to make a hash (a scrambled code that cannot be turned back into the address) that changes every day, so we can count a visitor once a day but cannot recognise the same person on another day. We keep the counts for at most 13 months. If your browser sends Do Not Track, we do not count your visit."
* Burmese title: "အမည်မဖော်သော လာရောက်မှု ရေတွက်ခြင်း"
* Burmese: "မည်သည့်စာမျက်နှာများ၊ သင်တန်းများ၊ တရားစခန်းများ၊ စာကြည့်တိုက်ဖိုလ်ဒါများ၊ စာအုပ်များနှင့် ဓမ္မဆောင်းပါးများကို မည်သည့်ဘာသာစကားဖြင့် အသုံးပြုသည်ကို သိနိုင်ရန် ကျွန်ုပ်တို့သည် လာရောက်မှုများကို ရေတွက်ပါသည်။ ကျွန်ုပ်တို့သည် Umami ဟူသော ဆော့ဖ်ဝဲကို ကျွန်ုပ်တို့၏ကိုယ်ပိုင် server ပေါ်တွင် (အမေရိကန်ပြည်ထောင်စုရှိ Amazon Web Services တွင် ဟိုစ်တင်း) ကိုယ်တိုင်လည်ပတ်စေသဖြင့် analytics ကုမ္ပဏီတစ်ခုခုက ဤအချက်အလက်ကို မရရှိပါ။ ရေတွက်ရာတွင် ကွတ်ကီး (cookie) မသုံးဘဲ သင့်စက်ထဲတွင် မည်သည့်အရာမျှ မသိမ်းဆည်းပါ။ သင့်အမည်၊ အီးမေးလ်လိပ်စာ၊ ရှာဖွေသည့်စကားလုံးများ သို့မဟုတ် သင်ရိုက်ထည့်သည့် မည်သည့်အရာကိုမျှ မစုဆောင်းပါ။ သင့် IP လိပ်စာကို မသိမ်းပါ။ နေ့စဉ်ပြောင်းလဲသော hash (မူလလိပ်စာသို့ ပြန်မဖော်နိုင်သည့် ရောထွေးကုဒ်) တစ်ခု ပြုလုပ်ရန်သာ အသုံးပြုသဖြင့် လာရောက်သူတစ်ဦးကို တစ်နေ့လျှင် တစ်ကြိမ်သာ ရေတွက်နိုင်ပြီး အခြားနေ့တွင် တူညီသူကို မသိနိုင်ပါ။ ရေတွက်ထားသည့် အရေအတွက်များကို အများဆုံး ၁၃ လ သိမ်းထားပါသည်။ သင့်ဘရောက်ဇာက Do Not Track ပို့လျှင် သင့်လာရောက်မှုကို မရေတွက်ပါ။"

Also update on the Privacy page: `privacyHosting` should list the stats server's host (`stats.app.winmetta.org`, Amazon Web Services) among the providers that see technical information such as IP address; word it the same way in both languages.
