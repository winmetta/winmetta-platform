# Analytics (Phase 4): privacy-first activity measurement

**Status:** planned 2026-10-26. Nothing in this document is built yet. Phases 0–3 collect no analytics and the Privacy page still says so; it changes only when the code ships (stage 4 in [implementation-plan.md](implementation-plan.md) §5A). Until then, [prd.md](prd.md) §4.7 and [tech-architecture.md](tech-architecture.md) §4.4 describe what is live.

**Why:** the site is public and Win Metta has no view of what helps learners: which classes and retreats people look up, whether the library search finds books, whether Burmese and Chinese readers use their language. Measurement should answer those questions without identifying anyone.

---

## 1. Decisions

| Decision | Choice | Notes |
| --- | --- | --- |
| Identity model | **Cookieless, aggregate only** | No cookie, no localStorage, no fingerprinting script, no persistent visitor ID. Decided 2026-10-26. |
| Tool | **Umami, self-hosted** | MIT license, light to run (Node.js + PostgreSQL), custom events, no cookies by default. |
| Hosting | One **AWS EC2** instance (`t4g.small`, 2 GB) in the existing AWS account, defined in Pulumi, with PostgreSQL on the same instance. Changed from Lightsail on 2026-10-29 | Host `stats.app.winmetta.org`, a record in the existing `app.winmetta.org` Route 53 zone (no new zone). Decided 2026-10-26; alternatives in section 5. |
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
| All pages | Automatic page view: path (no query string), referrer, interface locale (`en`, `my`), plus what Umami derives itself: country, device type, browser, browser language, time of day |
| Classes | `class_zoom_join_click`: class id, `source` (`schedule`, `next`, `class_page`); `class_detail_open`: class id (only if a class opens in a panel; separate pages are covered by page views); `class_timezone_change`: zone (only while the schedule has a time-zone control) |
| Retreats | `retreat_link_click`: retreat id, `kind` (`register`, `zoom`, `info`, `external`); `retreat_archive_open`: retreat id |
| Library | `library_search`: result count bucket, `script` (`my`, `latin`, `mixed`), `similar_shown` (true or false), `zawgyi_suspected` (true or false, decided in the browser; never the text); `library_result_click`: position bucket (1, 2–3, 4–10, more), `kind` (`exact`, `similar`); `library_tag_filter`: tag id; `library_folder_open`: folder id; `library_pdf_download`: book id, `from` (`search`, `folder`, `other`) |
| Dhamma Posts | `post_open`: post id, `langs` (languages shown, for example `my,en`); `post_language_change`: new set; `post_filter`: tag slug; `post_search`: result count bucket, `script`; `post_result_click`: position bucket; `post_share`: `kind` (`index`, `tag`, `post`); `post_print`: post id; `post_end_reached`: post id (once, when the end of the post scrolls into view; optional) |
| Reliability | `search_index_load`: `area` (`library`, `posts`), `ok` (true or false), time bucket (under 1 s, 1–3 s, 3–10 s, over 10 s); `page_not_found`: path without query string |
| General | `locale_switch`: from and to; `outbound_click`: destination domain only |

Rules for this table: add an event only with a question it answers (section 3.1); no free-text properties; counts and times are bucketed (counts 0, 1–5, 6–20, more) so a rare query or a single visitor cannot be recognized; `zawgyi_suspected` and `script` are computed in the browser and only the label is sent; changes to the table are made here first, in a PR. The list is a starting point and is expected to change as questions are added or dropped.

### 3.1 Questions and denominators

Without a visitor ID, the unit of counting is the **visitor-day (VD)**: one Umami session in one UTC day. A week's "visitors" is the sum of VDs, not the number of different people. Rates compare VDs that did something with VDs that could have: the share of VDs that viewed a page and then used a feature on it, or the share of events with a given outcome. "Page VD" below means the VDs that viewed that page or section.

Reporting rules: do not read or publish a rate when its denominator is under 30; do not report a breakdown with a group under 10; compare periods of the same length; report trends, not single days. Add a question here before adding an event for it, and drop events nobody reads.

| # | Question | Numerator | Denominator | Notes |
| --- | --- | --- | --- | --- |
| **Reach and audience** | | | | |
| 1 | How many people use the site, and is it growing? | VDs per day and week | Previous period | Weekly total is visitor-days, not unique people |
| 2 | Where do visitors come from, and does the link from winmetta.org work? | VDs by referrer | All VDs | Referrer `winmetta.org` is the link in the WordPress menu |
| 3 | Which language do visitors use? | VDs by interface locale and by browser language | All VDs | Shows how many Burmese-language browsers reach the site |
| 4 | Is the default language wrong for some visitors? | `locale_switch` VDs, by direction | All VDs, split by browser language | For example `en` to `my` among Burmese browsers |
| 5 | Mobile or desktop, which countries, which hours? | VDs by device, country, hour | All VDs | Plan class announcements, maintenance windows and layout work |
| **Classes and retreats** | | | | |
| 6 | Do visitors who look at classes find how to join? | VDs with `class_zoom_join_click` | Classes-page VDs | |
| 7 | Which classes get the most join clicks? | Join clicks by class id | All join clicks | |
| 8 | Is the "next class" shortcut used more than the full schedule? | Join clicks by `source` | All join clicks | |
| 9 | Do visitors need the Zoom help page? | Zoom-help page VDs | Classes-page VDs | |
| 10 | Do retreat pages lead anywhere? | VDs with `retreat_link_click`, by `kind` | Retreat-page VDs | Archive use: `retreat_archive_open` VDs over Retreats-page VDs |
| 11 | Are the Sayadaw and study group pages visited? | Page VDs per page | Classes-group VDs | |
| **Library** | | | | |
| 12 | Do searches succeed? | Searches with at least one result | All `library_search` events | Split by `script`; zero-result rate is the opposite |
| 13 | Do people open a result after searching? | `library_result_click` VDs | VDs with a search that had results | Share of clicks at position 1 shows whether ranking puts the best match first |
| 14 | Are "Similar books" (fuzzy matches) useful? | Result clicks with `kind=similar` | All result clicks | Also searches where `similar_shown` is true |
| 15 | Do Zawgyi-typed queries matter? | Searches with `zawgyi_suspected` true | All searches with `script=my` | Decides whether the Zawgyi search item in the backlog is worth doing |
| 16 | Do people browse folders or search? | Folder opens plus tag filters | Searches plus folder opens plus tag filters | Per library-page VD |
| 17 | Which books are downloaded? | `library_pdf_download` by book id and `from` | Library-page VDs | Counts clicks; real file delivery is in CDN logs |
| 18 | Does search work on slow connections? | `search_index_load` with `ok` true, by time bucket | All `search_index_load` events | Split by country and device; the weak-connection promise in prd.md §3 |
| **Dhamma Posts** | | | | |
| 19 | Which posts and topics are read? | `post_open` by post id; tag filters | Posts-section VDs | `post_end_reached` over `post_open` shows reading to the end |
| 20 | Which language combinations do readers choose? | `post_open` by `langs`; `post_language_change` VDs | `post_open` VDs | Includes how many readers add Chinese |
| 21 | Do readers find posts by search? | Searches with results; `post_result_click` | All `post_search` events | |
| 22 | Do readers share or print? | `post_share` and `post_print` VDs | `post_open` VDs | By `kind` |
| **Site health** | | | | |
| 23 | Are there broken links? | `page_not_found` by path | All VDs | Should be close to zero; find the referrer of each |
| 24 | Are the outside channels used? | `outbound_click` by destination domain | All VDs | YouTube, Facebook, winmetta.org |

**Not measurable by design** (no visitor ID across days): the same person returning, unique people per week or month, a visitor's path across days, and the prd.md §6 measures return-to-learn and bridge-to-community. If one becomes important, see the opt-in ID in section 1.

### Never collected

Names, email addresses, IP addresses stored in readable form, search or form text, Zoom IDs or passcodes a visitor types, precise location, device fingerprints, cookies, localStorage values, session replays, heatmaps, and any ID that survives past the daily salt. No advertising or third-party scripts. Nothing is shared or sold. Do Not Track is honored.

## 4. Privacy requirements

1. **No device storage.** The tracker must write no cookie and no localStorage or sessionStorage key. This keeps us outside the consent requirement of ePrivacy Article 5(3) and avoids a cookie banner. Verified in the browser's storage panel before launch and after any Umami upgrade.
2. **Daily salt rotation.** Umami's source (checked 2026-10-29) derives the session ID from the site, IP address, user agent and a salt that follows the `SALT_ROTATION` setting, which **defaults to monthly**. Set `SALT_ROTATION=day` explicitly and test it on the running server (the same IP and browser on two days must give two sessions); the default would let the same visitor be linked for a month and make the Privacy wording untrue. The salt is computed from the date and the app secret, not stored, so keep the app secret private. Visits (not sessions) also use an hourly salt, which is harmless.
3. **First-party only.** The tracker script and the data both live on `stats.app.winmetta.org`, and the data is used only by Win Metta.
4. **URLs without search words.** The library and posts keep the search in `?q=`. The tracker must report the path without query strings (`data-exclude-search="true"`), so search words never reach analytics. This also closes the gap the Privacy page already warns about for CDN logs.
5. **Retention.** Keep raw events at most 13 months, then delete (decided 2026-10-29).
6. **Honest wording.** Update the Privacy page (English and Burmese, with the "last updated" date) in the same PR that ships the tracker, saying what is counted and what is not. Draft wording, and the rule that the Burmese must match the English in meaning with some terms intentionally left in English, are in section 8.
7. **Private dashboard.** The dashboard has logins for authorized maintainers only; there is no public or shared read-only link (decided 2026-10-29). Every account requires two-factor sign-in. Who has access and how accounts are requested, created and removed is internal information kept in the private companion repo (section 10).
8. **Not a metric goal.** No streaks, DAU targets, rankings or engagement scores ([prd.md](prd.md) §3); this data is read by humans to improve content and fix problems.

## 5. Architecture

```
Visitor's browser (app.winmetta.org)
   | loads script.js and sends events (no cookie, no storage)
   v
stats.app.winmetta.org (Route 53 record in the app.winmetta.org zone, Elastic IP)
   |
   v
One EC2 instance (t4g.small, 2 GB RAM, Linux, Elastic IP attached, IAM instance role)
   - Caddy: HTTPS with Let's Encrypt, ports 80 and 443 only, reverse proxy
   - Umami (Node.js) on localhost
   - PostgreSQL on localhost or the container network
```

* Defined in Pulumi under `infra/pulumi`, reviewed with `pulumi preview`; **`pulumi up` is a manual maintainer step and needs explicit confirmation** (cloud write).
* Secrets (Umami app secret, database password, admin password) are set with `pulumi config set --secret` or come from the environment, never committed.
* Region: `us-east-1` (N. Virginia, the same region as the site) for the EC2 instance, snapshots and backup bucket (decided 2026-10-29).
* EC2 specifics: `t4g.small` (ARM, 2 GB RAM; the Umami image supports arm64; use `t3.small` if an x86 image is ever needed) in the default VPC, a 20 GB encrypted gp3 volume, an Elastic IP, and a security group that opens only ports 80 and 443. There is **no SSH port**: maintainers use AWS Systems Manager Session Manager through IAM sign-in, which keeps an audit log. The instance has an IAM role that can write one S3 prefix for backups and read its own secrets from Systems Manager Parameter Store; no access key is stored on the machine. Daily EBS snapshots (Data Lifecycle Manager, keep 14) are a second, whole-machine recovery path.
* Backups: nightly `pg_dump` to a private S3 bucket with a lifecycle rule (a snapshot alone is not enough); restore is rehearsed once and written in the runbook.
* Updates: pin the Umami image or version, upgrade monthly, apply OS security updates (unattended upgrades), record in the runbook.
* Estimated cost (rough, from memory of AWS pricing; verify before building): about $17–18 a month, or $200–220 a year: `t4g.small` about $12, 20 GB EBS about $2, public IPv4 address about $3.65 (AWS charges for every public IPv4), snapshots and backups a few dollars at most, Route 53 record and Let's Encrypt $0, data transfer negligible. Plus a small amount of maintenance time each month for updates and backup checks.
* If a CloudFront cache or DDoS cushion is wanted later, put it in front of the instance; not needed at launch.
* An ad blocker will hide some visitors, so counts are a floor, not a census. Proxying the script through the main domain is a later option.

### Hosting alternatives considered (2026-10-26)

| Option | Rough monthly cost | Why not now |
| --- | --- | --- |
| **EC2 `t4g.small`, Postgres on the same instance (chosen)** | $17–18 | Instance role means no stored backup key, Session Manager means no SSH port, and it matches how the rest of the AWS account is managed. |
| Lightsail VM (2 GB), Postgres on the same VM | $12 | About $5 cheaper with transfer and IPv4 bundled, but it cannot use an IAM role (so a backup access key would live on the machine) and has its own separate permission model. Fallback if cost matters more. |
| EC2 + Amazon RDS PostgreSQL | $20–25 | About double the cost for managed backups and patching; analytics data is small and easy to rebuild, so nightly dumps are enough. A reasonable upgrade later by changing the database URL. |
| Azure Container Apps + Azure Database for PostgreSQL (nonprofit grant) | $25–35, paid from the grant | The grant does not roll over and must be renewed yearly, and a second cloud adds credentials, a Pulumi provider and OIDC to maintain. Container Apps has built-in HTTPS, so no load balancer would be needed. Fallback if AWS spend becomes a concern. |
| Umami Cloud (free Hobby, Pro about $20) | $0–20 | No server to own; data lives with the vendor. Fallback if self-hosting stops being practical. |
| Application load balancer in front of any option | +$16 or more | Not needed for one instance; Caddy terminates HTTPS. |

## 6. Decisions

Decided 2026-10-29:

* **No public dashboard.** Numbers are visible only to authorized maintainers who have a login.
* **Retention:** raw events are kept at most 13 months, then deleted.
* **AWS region:** `us-east-1`, the same region as the site and the Pulumi state, so the same AWS provider covers the EC2 instance, its snapshots and the S3 backup bucket. Route 53 is global. Changed from `us-west-2` on 2026-10-29 for simplicity.
* **Internal information lives in the private companion repo** `winmetta/winmetta-platform-private` (decided 2026-10-30): who maintains the server, dashboard login process, alert routing and similar organization details are documented there, not here (section 10).
* **Alerts:** all alerts from the analytics server and AWS go to one organization admin group mailbox (details in the private repo), so no alert depends on one person.
* **Burmese Privacy wording review is a future todo** (decided 2026-10-30): the Burmese text in section 8 is published as drafted and reviewed by a Burmese speaker afterwards ([implementation-plan.md](implementation-plan.md) §6.1, group 5). The rule that it must match the English in meaning still applies.
* **Opt-in returning-visitor ID:** not now; it may be added in a future phase if a real need appears (section 1). It would need its own decision, a consent banner, a Privacy page change and a new legal check.
* **Legal review: done, low risk accepted.** See section 7.

How Win Metta is organized or run (who maintains the server, who administers what) is not published in this repository. Docs describe the system and its rules, not people or roles.

## 7. Legal review (completed 2026-10-29)

Review of the design, with the residual risks accepted as low. This is our own reading, not legal advice.

1. **Consent for device access (EU/UK ePrivacy, Article 5(3)):** applies only when information is stored on or read from the visitor's device. The design stores nothing and reads nothing from the device, so no consent or cookie banner is required. Kept true by checking storage before launch and after every Umami upgrade (section 4.1).
2. **GDPR and UK GDPR:** the daily hash is built from IP address, user agent and a salt, and regulators may treat an IP-derived value as personal data while the salt exists. Accepted position: legitimate interest (Article 6(1)(f)) for running the site; raw IPs are not stored; the salt rotates daily (`SALT_ROTATION=day`) so a value cannot be linked across days or back to a person without the app secret.
3. **Transparency:** the Privacy page, in English and Burmese, states what is counted and why, the daily hash, the 13-month retention and a contact (`contact@winmetta.org`), changing in the same PR as the tracker (section 8).
4. **Objection:** Do Not Track is honored. No separate opt-out page, because it would itself need storage.
5. **Retention:** 13 months for raw events (decided).
6. **Processor and region:** the data stays in Win Metta's own AWS account in `us-east-1`; AWS is the only processor and no analytics company receives the data.
7. **California (CCPA/CPRA):** no sale or sharing, no advertising use, nothing linked to a person.
8. **Myanmar and other countries:** counts are aggregate and non-identifying, so exposure is low.
9. **If an opt-in visitor ID is added later:** consent comes before anything is stored, with a way to withdraw, and this review is repeated.

## 8. Privacy page wording (draft for stage 4)

Drafts only. The live Privacy page keeps saying "no analytics" until the tracker ships (implementation-plan.md §5A, stage 4). Before publishing, check each statement is true of the running system (no IP stored, daily salt, 13-month deletion, storage empty).

> **Translation rule.** The Burmese Privacy text must mean exactly the same as the English text. Some terms are deliberately left in English (for example Umami, analytics, server, IP, hash, cookie, Do Not Track) because a Burmese rendering risks changing the meaning, or the Burmese word is not settled or not widely understood. Do not "fix" these by translating them. If the two versions ever differ in meaning, the English wording is checked first and the Burmese is corrected to match. Use the same Burmese nouns the site already uses elsewhere (for example for classes and retreats in `apps/web/src/i18n/messages/my.json`). A Burmese speaker reviews the published text afterwards; that review is a future todo ([implementation-plan.md](implementation-plan.md) §6.1, group 5), so the Burmese must be written carefully to match the English the first time.

**Replacement for `privacyNone`** (the first sentence changes; the rest stays):

* English: "This site has no accounts, no advertising and no tracking cookies, and it does not use analytics that identify you. It only counts visits anonymously (see \"Anonymous visit counts\" below). Searching and filtering happen in your browser, and typing a search does not send it to us. See \"Search words in the page address\" below for one exception."
* Burmese: "ဤဆိုက်တွင် အကောင့်၊ ကြော်ငြာနှင့် ခြေရာခံ ကွတ်ကီး (cookie) များ မရှိပါ။ သင့်ကို ခွဲခြားမှတ်သားနိုင်သည့် analytics ကိုလည်း မသုံးပါ။ လာရောက်မှုများကို အမည်မဖော်ဘဲသာ ရေတွက်ပါသည် (အောက်ပါ \"အမည်မဖော်သော လာရောက်မှု ရေတွက်ခြင်း\" ကို ကြည့်ပါ)။ ရှာဖွေခြင်းနှင့် စစ်ထုတ်ခြင်းကို သင့်ဘရောက်ဇာထဲတွင်ပင် လုပ်ဆောင်ပြီး ရိုက်ထည့်သော ရှာဖွေစကားလုံးများကို ကျွန်ုပ်တို့ထံ ပို့ခြင်း မရှိပါ။ ခြွင်းချက်တစ်ခုအတွက် အောက်ပါ \"စာမျက်နှာလိပ်စာထဲရှိ ရှာဖွေစကားလုံးများ\" ကို ကြည့်ပါ။"

**New section `privacyAnalyticsTitle` and `privacyAnalytics`:**

* English title: "Anonymous visit counts"
* English: "We count visits so that we can see which pages, classes, retreats, library folders, books and Dhamma posts are used, and in which languages. We use Umami, software that we run ourselves on our own server (hosted with Amazon Web Services in the United States), so no analytics company receives this data. The counting uses no cookies and stores nothing on your device. It does not collect your name, e-mail address, the words you search for, or anything you type. Your IP address is not stored. It is only used to make a hash (a scrambled code that cannot be turned back into the address) that changes every day, so we can count a visitor once a day but cannot recognise the same person on another day. We keep the counts for at most 13 months. If your browser sends Do Not Track, we do not count your visit."
* Burmese title: "အမည်မဖော်သော လာရောက်မှု ရေတွက်ခြင်း"
* Burmese: "မည်သည့်စာမျက်နှာများ၊ သင်တန်းများ၊ တရားစခန်းများ၊ စာကြည့်တိုက်ဖိုလ်ဒါများ၊ စာအုပ်များနှင့် ဓမ္မဆောင်းပါးများကို မည်သည့်ဘာသာစကားဖြင့် အသုံးပြုသည်ကို သိနိုင်ရန် ကျွန်ုပ်တို့သည် လာရောက်မှုများကို ရေတွက်ပါသည်။ ကျွန်ုပ်တို့သည် Umami ဟူသော ဆော့ဖ်ဝဲကို ကျွန်ုပ်တို့၏ကိုယ်ပိုင် server ပေါ်တွင် (အမေရိကန်ပြည်ထောင်စုရှိ Amazon Web Services တွင် ဟိုစ်တင်း) ကိုယ်တိုင်လည်ပတ်စေသဖြင့် analytics ကုမ္ပဏီတစ်ခုခုက ဤအချက်အလက်ကို မရရှိပါ။ ရေတွက်ရာတွင် ကွတ်ကီး (cookie) မသုံးဘဲ သင့်စက်ထဲတွင် မည်သည့်အရာမျှ မသိမ်းဆည်းပါ။ သင့်အမည်၊ အီးမေးလ်လိပ်စာ၊ ရှာဖွေသည့်စကားလုံးများ သို့မဟုတ် သင်ရိုက်ထည့်သည့် မည်သည့်အရာကိုမျှ မစုဆောင်းပါ။ သင့် IP လိပ်စာကို မသိမ်းပါ။ နေ့စဉ်ပြောင်းလဲသော hash (မူလလိပ်စာသို့ ပြန်မဖော်နိုင်သည့် ရောထွေးကုဒ်) တစ်ခု ပြုလုပ်ရန်သာ အသုံးပြုသဖြင့် လာရောက်သူတစ်ဦးကို တစ်နေ့လျှင် တစ်ကြိမ်သာ ရေတွက်နိုင်ပြီး အခြားနေ့တွင် တူညီသူကို မသိနိုင်ပါ။ ရေတွက်ထားသည့် အရေအတွက်များကို အများဆုံး ၁၃ လ သိမ်းထားပါသည်။ သင့်ဘရောက်ဇာက Do Not Track ပို့လျှင် သင့်လာရောက်မှုကို မရေတွက်ပါ။"

Also update on the Privacy page: `privacyHosting` should list the stats server's host (`stats.app.winmetta.org`, Amazon Web Services) among the providers that see technical information such as IP address; word it the same way in both languages.

## 9. Before implementing (review 2026-10-29)

Items found in a review of this plan. The stage that must settle each is in brackets (implementation-plan.md §5A).

### Must settle first

1. **Daily salt** [stage 2]: Umami's session salt defaults to monthly. Set `SALT_ROTATION=day` and prove it on the running server: the same browser on two different days must give two different sessions. Until proven, the Privacy wording about a daily-changing hash is not true. The salt is computed from the date and the app secret and is not stored, so the app secret stays private and is never committed.
2. **Backup permissions** [stage 2]: the EC2 instance role may write one prefix of the backup bucket (no delete, no read of other objects) and read only its own Parameter Store secrets. No access key is created or stored. Keep secrets out of git and out of Pulumi user data (user data is readable in the AWS console); the install script fetches them from Parameter Store at boot. Write the restore steps in the runbook.
3. **Retention mechanism** [stage 2]: confirm whether Umami deletes old events by itself. If not, add a scheduled job that deletes events older than 13 months, and an S3 lifecycle rule that expires dumps on the same schedule. Check it works with a test row.
4. **Dashboard login** [stage 2]: the login page is on the public internet, so harden it (decided 2026-10-30):
   * **Mandatory two-factor sign-in for every account.** Umami v3.3.0 or later supports authenticator-app (TOTP) 2FA and lets an administrator require it globally. Pin Umami to at least that version, set the global requirement before any reader account exists, and test that an account without 2FA is blocked.
   * **`TWO_FACTOR_ENCRYPTION_KEY`** (64 hex characters, unique to this installation) must be set on the server or nobody can enrol. Store it in AWS Parameter Store and **preserve it in backups and recovery**: if it is lost or changed, stored 2FA secrets become unreadable and every user must re-enrol. A sealed copy is kept by the administrators (private repo).
   * **Individual, least-privilege accounts:** readers are View Only members of a team that owns the website (a new account sees nothing otherwise); two named administrators with separate credentials; no shared logins; no public share links.
   * **Harden the public login:** change the default administrator credentials before the server is reachable, rate-limit authentication in Caddy (Umami also locks 2FA attempts for 15 minutes after five failures), and apply Umami and OS security updates promptly.
   * **Option for later:** make the dashboard reachable only over a private network (Tailscale), leaving only the tracker script and collection endpoints public. It needs the dashboard users to install Tailscale, so it is revisited after launch ([Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)).
   The account and 2FA process is in the private repo (section 10).

### Settle during the build

5. **Test and preview traffic** [stage 3]: the Playwright smoke tests run against the live site after each deploy. Restrict the tracker with `data-domains="app.winmetta.org"`, keep it off in dev, preview and CI builds (build flag), and check that Umami ignores headless-browser traffic or the tests add events.
6. **Duplicate page views** [stage 3]: the library and posts pages change the address (`?q=`, `?lang=`) without reloading. With query strings excluded, check that a search or filter does not count as a new page view.
7. **Pulumi permissions** [stage 2]: the read-only preview role used by pull requests needs read access to the EC2, EBS, Elastic IP, security group and Systems Manager resources it will describe, or `pulumi-preview` fails; `pulumi up` stays a manual run with the admin profile. Put the analytics stack in its own file (`infra/pulumi/index.ts` is already about 500 lines).
8. **Instance size** [stage 2]: 2 GB RAM (`t4g.small`) is the minimum for Umami and PostgreSQL; confirm the price and watch memory.
9. **Fake events** [stage 2]: the collection endpoint is public, so anyone can send made-up events. Accept it, add Caddy rate limits, and treat the numbers as indicative.
10. **Ad blockers** [stage 3]: the default script and endpoint names are on blocklists. They can be renamed with `TRACKER_SCRIPT_NAME` and `COLLECT_API_ENDPOINT`.
11. **Monitoring** [stage 2]: all alerts go to the organization admin group mailbox (set-up and subscription steps are in the private repo, section 10). An uptime check, certificate expiry, CloudWatch alarms for instance status and disk space, a check that snapshots and dumps ran, and an AWS budget alert for the new resources. Without them a stopped server loses events silently.
12. **Content security policy** [later]: the site sends none today. If one is added, it must allow `stats.app.winmetta.org`.
13. **Runbook** [stage 2 and 4]: add deploy, upgrade, backup, restore, retention and salt-check sections to `docs/runbook.md`, and have someone who did not build the server run the restore drill.
14. **Rollout order** [stages 2 to 4]: deploy the server first and check it with a test site, then ship the tracker behind the build flag, and turn the flag on only in the same PR as the Privacy page change and only after the restore drill has passed.

## 10. Internal information (private companion repo)

Information about people and how Win Metta is run is **not** kept in this public repo. It lives in the private companion repo `winmetta/winmetta-platform-private` (cloned next to this one; access on request). Rule: facts about the system and rules for contributors are public; names, mailboxes, access lists and how the organization or its volunteers are run are private. See `AGENTS.md` §2 in both repos.

What the private repo holds for this phase:

* **Roles and contacts:** who maintains the analytics server, who administers the dashboard, who is in the alert group (`winmetta-platform-private/docs/roles-and-contacts.md`).
* **Dashboard logins:** who may have an account, the request, creation, review and removal process, and the first-boot administrator steps (`winmetta-platform-private/docs/analytics-operations.md`, section 1).
* **Alerts:** where they go, how the email subscription is confirmed, what the group must allow, a quarterly test, and what to do on arrival (`winmetta-platform-private/docs/analytics-operations.md`, section 2).
* **Decisions and org-side todos** such as the Burmese-wording reviewer (`winmetta-platform-private/docs/decisions.md`, `winmetta-platform-private/docs/todo.md`).

Scripts for private operations, if any are needed, go in `winmetta-platform-private/scripts/`. Never put a password, key or token in either repo; say where it lives (the organization's password manager, AWS Parameter Store).
