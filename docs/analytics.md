# Analytics (Phase 4): privacy-first activity measurement

**Status:** planned 2026-10-26. Nothing in this document is built yet. Phases 0–3 collect no analytics and the Privacy page still says so; it changes only when the code ships (stage 4 in [implementation-plan.md](implementation-plan.md) §5A). Until then, [prd.md](prd.md) §4.7 and [tech-architecture.md](tech-architecture.md) §4.4 describe what is live.

**Why:** the site is public and volunteers have no view of what helps learners: which classes and retreats people look up, whether the library search finds books, whether Burmese and Chinese readers use their language. Measurement should answer those questions without identifying anyone.

---

## 1. Decisions

| Decision | Choice | Notes |
| --- | --- | --- |
| Identity model | **Cookieless, aggregate only** | No cookie, no localStorage, no fingerprinting script, no persistent visitor ID. Decided 2026-10-26. |
| Tool | **Umami, self-hosted** | MIT license, light to run (Node.js + PostgreSQL), custom events, no cookies by default. |
| Hosting | One small instance in the existing AWS account, defined in Pulumi | Host `stats.app.winmetta.org`, a record in the existing `app.winmetta.org` Route 53 zone (no new zone). |
| HTTPS | **Caddy** on the instance, Let's Encrypt | Not an Application Load Balancer (about $16 a month, more than the server) and not nginx + certbot (same result, more parts). |
| Scope | `winmetta-platform` only | The retreat apps and `learn_burmese` are out of scope. |

### What cookieless means for the questions we can answer

Umami derives a visitor hash from the site, IP address, user agent and a rotating salt, and stores no ID in the browser. With the salt rotated daily, the same person on two different days looks like two visitors. So:

* **We can answer:** page views, unique visitors per day, which pages, classes, library folders, books (downloads), posts, tags and languages are used, which interface and reading languages, referrers, countries and device types, how many searches return nothing, and trends of all of these over weeks and months.
* **We cannot answer:** whether the same person came back next week, a single person's journey across days, or per-learner retention. The candidate measures in [prd.md](prd.md) §6 that need this (return-to-learn, bridge-to-community) stay unmeasured on the server. If a learner-progress feature is built later, progress stays **on the learner's own device** (IndexedDB, [tech-architecture.md](tech-architecture.md) §4.3), not sent to us.
* **Not decided, and not built:** an opt-in "recognize me across visits" ID (a random UUID kept in the browser only after the visitor agrees, passed to Umami as a distinct ID). It would add a consent banner, change the Privacy promise and need a legal check, so it is a separate decision for a later phase if the volunteers still want per-visitor continuity.

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

Cloud option for Umami (Hobby/Pro) remains a fallback if no volunteer can run the server; moving between self-hosted and cloud does not change the tracker or events.

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
5. **Retention.** Keep raw events at most 13 months, then delete.
6. **Honest wording.** Update the Privacy page (English and Burmese, with the "last updated" date) in the same PR that ships the tracker, saying what is counted and what is not, and link to this page's summary.
7. **Open access to the numbers, not the people.** The dashboard has logins for two or three organizers; a public read-only share link of aggregate numbers is optional.
8. **Not a metric goal.** No streaks, DAU targets, rankings or engagement scores ([prd.md](prd.md) §3); this data is read by humans to improve content and fix problems.

## 5. Architecture

```
Visitor's browser (app.winmetta.org)
   | loads script.js and sends events (no cookie, no storage)
   v
stats.app.winmetta.org (Route 53 record in the app.winmetta.org zone, static IP)
   |
   v
One small instance (Lightsail or EC2)
   - Caddy: HTTPS with Let's Encrypt, ports 80 and 443 only, reverse proxy
   - Umami (Node.js) on localhost
   - PostgreSQL on localhost or the container network
```

* Defined in Pulumi under `infra/pulumi`, reviewed with `pulumi preview`; **`pulumi up` is a manual maintainer step and needs explicit confirmation** (cloud write).
* Secrets (Umami app secret, database password, admin password) are set with `pulumi config set --secret` or come from the environment, never committed.
* Backups: nightly database dump to a private S3 bucket with a lifecycle rule; restore is rehearsed once and written in the runbook.
* Updates: pin the Umami image or version, upgrade monthly, record in the runbook. Estimated cost is about $5–10 a month plus the dump bucket.
* If a CloudFront cache or DDoS cushion is wanted later, put it in front of the instance; not needed at launch.
* An ad blocker will hide some visitors, so counts are a floor, not a census. Proxying the script through the main domain is a later option.

## 6. Open questions

* Who is the volunteer owner of the server (updates, backups, access)? Without one, switch to Umami Cloud.
* Whether to publish a public read-only dashboard.
* Whether to ever add the opt-in returning-visitor ID (section 1).
* Legal review: confirm with counsel that a cookieless, no-storage setup needs no consent for the visitors we serve, including EU and California visitors.
* Whether Burmese-speaking reviewers should approve the Burmese Privacy wording (yes, same as other Burmese interface text).
