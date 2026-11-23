# Donations: the Dāna page and donation receipts

Planned 2026-11-23. Win Metta is a 501(c)(3) public charity and dāna is its base funding model ([prd.md](prd.md) §5). This doc covers what the platform shows donors and how receipts will be made. Internal details stay in the private `winmetta-platform-private` repo: who approves wording, group mailbox addresses, the receipt-number policy, bank and Zelle settings, and the receipt tool's code. This repo holds only public product design.

Nothing here is legal or tax advice. The tax and receipt wording needs the Treasurer's approval, and a CPA should check it before `PUBLIC_DONATE` is turned on.

## 1. Stage A: the Dāna page (built)

`/<locale>/donate/` (`apps/web/src/pages/[locale]/donate/index.astro`), a static page in English and Burmese. It replaces, on this site, the WordPress page https://winmetta.org/dhamma-donation/, which stays as it is.

- **Why give.** A card for each thing dāna pays for: online classes, retreats and study groups (Zoom, Restream); teaching materials (Canva, AI assistants such as Claude and ChatGPT); hosting for this site and the Dhamma Library (AWS); tools for volunteers (Google Workspace, 1Password); support for Sayadaws, teachers and retreats. The list is `donationSupports` in `apps/web/src/lib/donation.ts` and its text is message keys. No goal bars, counters, urgency or donor lists ([design-guide.md](design-guide.md) §7).
- **Give to Win Metta.** Zelle (address with a copy text action, plus the registered name), check (payee and mailing address), and the purposes to write in the memo (`donationPurposes`).
- **Tax receipts.** The 501(c)(3) status and EIN, and where to email for a receipt. It also says that a gift naming a Sayadaw, monastery or program is followed where possible, but the board makes the final decision on its use. That discretion and control is what keeps a designated gift deductible and avoids Win Metta acting as a pass-through. This replaces the old instruction to text a person's phone; no personal phone number is published.
- **Give directly to a monastery.** Other organizations that donors give to directly, under a note that these gifts are not gifts to Win Metta and get no Win Metta receipt. Each card links the related teacher pages.

**Data:** `apps/web/src/content/donation.json`, validated by `donationSchema` in `apps/web/src/lib/schemas.ts`. The loader checks that every teacher id exists. Only **organization** addresses go here. A person's phone number or personal email never goes in this public repo (AGENTS.md §2), even when the WordPress page shows it. For those payees the card links to the WordPress page (`detailsUrl`). Ask an organization before adding it, and remove it when it asks.

**Gate:** the page is always built, but stays unlinked, `noindex` and out of the sitemap until `PUBLIC_DONATE=true`. That flag adds the Donate link in the header navigation and the footer, and the About card. Local `npm run dev` / `just dev` always turns it on (`scripts/dev-options.mjs`), so developers see the linked page. Turn it on in the `production` environment only after all of these:

- [ ] The board or Treasurer approves the tax, receipt and discretion wording, after a CPA check.
- [ ] The board agrees to name the service vendors publicly (otherwise use generic wording such as "video meetings" and "web hosting").
- [ ] A native Burmese reader reviews every `donate*` and `aboutDana*` message in `my.json`.
- [ ] Each listed organization agrees to be listed with the details shown.
- [ ] The Privacy page needs no change: the page collects nothing and sends no analytics events beyond the page view.

## 2. Stage B: manual receipt generator (planned, not built)

**Goal:** a volunteer with a `@winmetta.org` account makes a correct PDF receipt in a minute and sends its link to the donor by email or text message by hand.

**Recommended build:** a Google Apps Script web app inside the Win Metta Google Workspace, deployed so that only accounts in the winmetta.org domain can open it. Its code lives in a private repo (managed with `clasp`), because it handles donor names and contact details. It never goes in this public repo or on app.winmetta.org.

- **Form:** donor name; email and/or phone; amount; date received; method (Zelle, check, cash, online platform); fund or purpose (the page's purposes list); preferred Sayadaw or monastery (optional); goods or services given in return (default none, otherwise description and good-faith value); receipt language (English, Burmese or both).
- **Output:**
  - A PDF made from a Google Docs template, saved in a restricted Drive folder.
  - A row in a donation log sheet: receipt number, form fields, who issued it and when.
  - A link to the PDF.
- **Receipt content (IRS written acknowledgment):**
  - Win Metta's legal name, address and EIN; receipt number; donor name; date and amount; fund.
  - "No goods or services were provided in exchange for this contribution", or a description and good-faith value. A retreat payment over $75 that includes meals or lodging needs this quid pro quo statement.
  - The discretion-and-control sentence for designated gifts.
  - Signed by the organization.
- **Sending is manual:**
  - **Email** sends from the donations group alias (not a personal inbox).
  - **Text** opens an `sms:` link with the message and receipt link already filled in, so the volunteer sends it from their own phone.
  - The donor's phone number and email are never sent to any other service.
- **Controls:**
  - Receipt numbers are sequential and never reused; a correction voids the old receipt and issues a new one.
  - The Treasurer reconciles the log with the bank statements every month, and the person issuing receipts does not reconcile.
  - Records are kept for at least seven years.
  - Link sharing is limited to people with the link (and to a time limit where Workspace allows).
- **Why not on this platform:** it would be the platform's first backend that stores personal data, needing sign-in, storage and its own security review. Apps Script costs nothing, reuses Workspace sign-in, and keeps donor data inside the Workspace the organization already controls.

## 3. Stage C: automatic receipts (future)

Build only after Stage B has run correctly for a few months.

- **Online card and bank gifts:** a nonprofit giving platform (for example Zeffy, which charges the organization nothing) already emails its own tax receipts. Turn those on and copy its transactions into the log so no donor gets two receipts.
- **Zelle (Chase):** Chase offers no transaction API for small business accounts. Options:
  1. **(Preferred)** Send Chase's "Zelle payment received" alert emails to the donations group. An Apps Script trigger reads each alert into a **draft** receipt, and a volunteer adds the missing email or phone and sends it with the Stage B buttons. Zelle often lacks the donor's contact details, so sending stays human-checked.
  2. Import the monthly CSV export.
  3. A bank-data aggregator (paid; needs board approval to connect it to the bank).
- **Automatic SMS:** needs a provider (for example Twilio or Amazon SNS), US 10DLC registration and the donor's consent to texts. Start with email; add SMS only if donors ask for it.
- **Year-end:** a January giving statement for each donor, made from the log.
