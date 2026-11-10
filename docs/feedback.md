# Feedback form and Sādhu button

**Status:** planned 2026-11-10; nothing is built yet. The staged plan is in [implementation-plan.md](implementation-plan.md) §5B.

**Why:** the site is public and its content is only as good as its corrections. A visitor who finds a typo in a Dhamma Post, a wrong class time or a broken book link has no way to tell us. Win Metta also has no way to tell which posts readers value, other than page views ([analytics.md](analytics.md)).

This adds two things, both without accounts, cookies or a database:

1. **A report form** in an in-place dialog, opened from a link on the page where the problem is, with the page already filled in.
2. **A Sādhu button** at the end of each Dhamma Post, a private appreciation signal.

---

## 1. Decisions (2026-11-10)

| Decision | Choice | Notes |
| --- | --- | --- |
| Own form or a hosted one | **Own form** | One small endpoint on the AWS account the site already uses. No third-party form provider sees reports. |
| Endpoint | **AWS Lambda behind a Function URL (no auth), reached through CloudFront at `/api/feedback`** | Same origin as the site, so no CORS and no new domain. |
| Access control | **A shared secret header.** CloudFront adds `x-feedback-secret` to every request it forwards; the Lambda rejects a request without it | The Function URL itself is public, so this header is the only gate. Chosen over origin access control, which would make the browser compute a hash of every request body. See section 5. |
| Delivery | **Amazon SNS email, plain text** | Starts simple. SES (replyable, formatted mail) is a later option; it needs a verified sender domain. |
| Storage | **None.** The report exists only as the email | No database, no table, no log of the text. How long mailboxes keep reports is an organization decision (private repository). |
| Form UI | **An in-place dialog** (the native `<dialog>` element), one shared component | Keeps the reader on the page. Without JavaScript the same links open a `mailto:` message instead. |
| Contexts in v1 | **All four:** Dhamma Post, classes and retreats, library, general | Each has its own problem types and recipient (section 2). |
| Appreciation | **A single Sādhu (သာဓု) button on posts, private signal only** | No public count, no ranking, no thumbs-down. A down-vote is replaced by "Report a problem". See section 4. |
| Reply from the site | **No.** Replies happen by email, only if the reporter gave an address | |

Out of scope: attachments or screenshots, accounts, a public list of reports, CAPTCHAs, public like counts, reactions on anything other than posts.

---

## 2. Contexts, problem types and recipients

One form component and one endpoint. A **context** decides which problem types the form offers, what it prefills, and where the report goes. The contexts and types live in **one shared file** used by the form and the Lambda, with a test that checks they agree.

| Context | Where the link appears | Problem types | Route |
| --- | --- | --- | --- |
| `post` | Post toolbar (beside Share and Print) and a small link in each language section, which prefills that language | typo, wrong content, translation problem, other | `content` |
| `class` | A "Something wrong?" link on each class, study group and retreat card, on the Sayadaws and Zoom help pages, and one at the top of the schedule table | class time wrong, Zoom ID or passcode wrong, language wrong, retreat detail wrong, other | `schedule` |
| `library` | On each book card | broken file or link, wrong title or tag, other | `site` for a broken file or link and for other; `content` for a wrong title or tag |
| `general` | The site footer on every page, and a menu entry if the menu has room | suggestion, website problem, other | `site` |

- **No floating button.** The calm, distraction-free design rule applies.
- **Recipients.** The Lambda sets the SNS `route` attribute (`schedule`, `content` or `site`) from the context and type, never from a value the browser sends. SNS filter policies send each route to its own group mailbox. Which group reads which route is set in the private repository.
- **Teachers' wording.** A "wrong content" report starts a check with the teacher or class host; the text is never edited from the report alone (AGENTS.md §6, §7).
- **Prefill.** A link carries the context, the page path, an item id and, for posts, the language, as attributes on the link. The dialog shows "About: …" so the reporter sees what will be sent.

---

## 3. The report request

`POST /api/feedback`, a JSON body of at most 8 KB. Nothing but these fields is read; unknown fields are dropped.

| Field | Rule |
| --- | --- |
| `ctx` | one of `post`, `class`, `library`, `general` |
| `type` | one of the types listed for that `ctx` |
| `message` | required, 1 to 2,000 characters, plain text |
| `email` | optional, at most 254 characters, a simple address check; used only to reply |
| `page` | a site path such as `/en/dhamma-posts/<id>/`: the locale and known characters only, at most 200 characters, no query string or fragment |
| `item` | optional, an id such as a post id or class id: lowercase letters, digits, `.`, `_` and `-`, at most 80 characters |
| `lang` | optional, `my`, `en` or `zh-Hans` (posts only) |
| `locale` | `en` or `my`, the interface language |
| `hp` | a hidden field that must be empty |
| `t` | milliseconds the dialog was open; a report sent in under 3 seconds is dropped |

Responses: `204` accepted (including a silently dropped bot report), `400` invalid, `403` missing or wrong secret, `413` too large, `429` throttled. On any failure the dialog says so and offers the `mailto:` address.

**The email.** SNS plain text. The subject is ASCII only and at most 100 characters (SNS rules), for example `[Win Metta] class / time wrong`. The body lists the context, type, page, item, language and locale, then the message and the reply address. It never contains an IP address or browser details; the Lambda does not read them. Message attributes `route` and `ctx` drive the filter policies.

---

## 4. The Sādhu button

- **What it is:** one button, "Sādhu" in English and "သာဓု" in Burmese, once per post page, after the last language section. A click shows a short thank-you and sends the analytics event `post_reaction` with `post` (the post id) and `kind=sadhu` ([analytics.md](analytics.md) §3).
- **What it is not:** there is no public count, no sorting or recommending by it, no thumbs-down, no streaks or badges (AGENTS.md §1, §6). It is a signal for the team, read in the Umami dashboard and in the one-month review (stage 6 in [implementation-plan.md](implementation-plan.md) §5B).
- **No storage.** After one click the button is disabled for that page view, in memory only. A reload allows another click, so the numbers are rough clicks, not people. This is the price of having no identity.
- **Do Not Track.** The tracker does not load when Do Not Track is on, so nothing is counted; the reader still sees the thank-you.
- **Wording.** "Sādhu" is the traditional expression of appreciation for a teaching. A Burmese speaker (ideally a teacher) confirms the label and the Burmese thank-you text before the post links go live (backlog item in [implementation-plan.md](implementation-plan.md) §6.1).

If public counts are ever wanted, that is a new decision: it needs a small database, a way to limit repeats and a Privacy page change.

---

## 5. Infrastructure

Defined in Pulumi (TypeScript) as a component `infra/pulumi/feedback.ts`, behind a stack flag `feedbackEnabled`, with the function in `infra/feedback/` (like `infra/analytics/`).

- **Lambda:** Node.js (the repo's version), arm64, 128 MB, 5 second timeout, **reserved concurrency 2** (extra requests get `429`; setting it to 0 is the kill switch). The log group keeps 14 days and the code never logs a request body or header. The function reads the secret from its environment (set from Pulumi secret config, never from git).
- **Secret header:** CloudFront adds `x-feedback-secret: <secret>` as an origin custom header. The Lambda compares it in constant time and also accepts `FEEDBACK_SECRET_PREVIOUS`, so the secret can be rotated without downtime: add the new value as current, move the old to previous, change CloudFront, then drop the previous. The header value is visible to anyone with CloudFront read access in the AWS account.
- **CloudFront:** a second origin (the Function URL host) and an ordered behavior for `/api/feedback`. POST needs the "all methods" allowed set. Caching is off and the origin request policy forwards no cookies, headers or query strings. The existing response headers policy applies.
- **A Function URL without auth is reachable directly.** Without the header a call gets `403`, but it still starts the function. The concurrency cap and an alarm (below) limit what that can cost.
- **SNS:** one `feedback` topic with email subscriptions and filter policies on `route`. Subscribers confirm by link, so the group mailboxes must be able to receive the confirmation.
- **Alarm:** a CloudWatch alarm when the function runs unusually often in a day (about 200 invocations), notifying the organization admin group the way the analytics alerts do.
- **Cost:** well under $1 a month at this scale (Lambda and SNS email fall in the free allowances). Resources are tagged `component=feedback` and covered by the existing monthly budget alert.
- **Cloud writes** (`pulumi up`, subscribing mailboxes, setting the secret) need the maintainer's explicit go-ahead, with a `pulumi preview` first. The procedures go in the private repository's runbook.

### Alternatives considered

- **Origin access control to the Function URL:** keeps the URL private, but for a POST the browser must send the SHA-256 of the body in `x-amz-content-sha256`. Rejected for the extra client code.
- **API Gateway HTTP API:** no such quirk, about $1 per million requests, but one more service to define. A fallback if the header approach causes trouble.
- **Hosted forms (Google Forms and similar):** no code, but a third party holds the reports and the Privacy page changes the same way. Rejected for this design.
- **SES instead of SNS:** replyable HTML mail; needs a verified sender domain (easy for `app.winmetta.org`, whose zone is in Route 53). A later upgrade.
- **A daily counter in a database** to cap reports: not needed yet. Add it only if the concurrency cap and alarm prove too weak.

---

## 6. Privacy and analytics

- **Nothing is stored on the server**, apart from the email and a Lambda log without the request. The Lambda does not read the IP address or user agent. No cookie or storage key is added, and nothing is sent until the reporter presses Send.
- **The Privacy page** (English and Burmese), changed in the same PR that ships the dialog: reports are emailed to the Win Metta team; the optional reply address is used only to answer; the message may include what the reporter types, so please leave out personal details; the Sādhu button counts clicks anonymously.
- **Analytics events** ([analytics.md](analytics.md) §3, added there first): `feedback_open` (`ctx`), `feedback_submit` (`ctx`, `type`, `ok`) and `post_reaction` (`post`, `kind`). Never the message, the address or the page text. The form page is not tracked separately: the dialog has no URL.
- **Public repo:** no mailbox names, subscriber lists or the secret in this repository. Routing and rotation steps live in `winmetta-platform-private`.

---

## 7. Accessibility and languages

- The native `<dialog>` with `showModal()` traps focus, closes on Escape and returns focus to the link that opened it. It has a visible heading, labelled fields, an `aria-live` status for errors and the thank-you, and works at mobile widths.
- Every label, type name, error and thank-you is in English and Burmese (Unicode, same nouns as the rest of the site). The Burmese text is reviewed by a Burmese speaker afterwards, like the other interface text (backlog).
- Reports are accepted in any language the reporter writes.

---

## 8. Open questions

1. Which groups receive which route, and who answers a reporter? (Private repository.)
2. How long do mailboxes keep reports? (Private repository.)
3. Does a teacher prefer another word than Sādhu, or an extra line of thanks? (Confirm before the post links go live.)
4. Do we need a daily cap with a counter? (Only if abuse appears.)

---

## 9. Acceptance

- A report from each context reaches the right group mailbox, with the page, item and language filled in.
- A request without the secret gets `403`; a bot-filled hidden field or a report under 3 seconds produces no email.
- No cookie or storage key is written, and no request or log keeps the message text.
- The dialog works by keyboard and on a phone, in both languages, and the links fall back to `mailto:` without JavaScript.
- The Sādhu click appears as `post_reaction` in Umami, and nothing on the site shows a count.
- The Privacy page matches what is collected.
