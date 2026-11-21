# Design guide

Rules for the look and behaviour of the site, so that every page, and every feature added later by a person or an AI agent, feels like the same product. The visual tokens (palette, fonts) are in [AGENTS.md](../AGENTS.md) §6 and `apps/web/src/styles/global.css`; this guide says how to use them. When a rule here and the code disagree, fix whichever is wrong in the same change.

Principles behind every rule: calm and legible, nothing that pulls attention for its own sake, the same thing always looks and is worded the same way, and a reader with a slow phone, a small screen or a Burmese interface is never an afterthought.

## 1. Clickable or not: what each element means

A reader decides what to tap by how a thing looks, so **only things that do something may look like they do something.** If clicking an element does nothing, it must be a badge or plain text.

| Element | Class | Use it for | Never for |
| --- | --- | --- | --- |
| Primary button | `.btn .btn-primary` | The one main action of a card or form: Search, Open PDF | Status, labels, navigation to another page |
| Secondary button | `.btn .btn-outline` | A secondary action: Copy citation, Show more, Try again | Information |
| Link | `.link` (brand color, semibold, no underline until hover) | Going to another page or file | Actions that change the page |
| Text action | `.text-action` (a real `<button>` styled as an icon and words in the link color, no frame) | A small action next to content: **Copy citation** (copy icon, then a check icon and "Copied") | The main action of a card, or navigation |
| Quiet link | `.link-quiet` (small, muted, no bold; hover underline) in a `.card-aside` or `.card-actions` row | A secondary utility link inside a card: **Something wrong?** | Content, or anything the reader came to do |
| Chip | `.chip` | A clickable filter, tag link or toggle (`<a>` or `<button>`) | Anything that is not clickable |
| Badge | `.badge` | Read-only facts: a count, a state ("Read by OCR"), a page number, a size | Anything clickable |

Rules that follow:

- A badge has no pointer cursor, no hover state and no `title`-only meaning: if it carries information a reader needs, the words are visible on the page (tooltips do not exist on touch screens).
- Do not turn a chip into a badge by removing its link, or a badge into a chip by adding a click. Change the class with the behaviour.
- Small, repeated actions such as Copy are text actions with the symbol readers know from other sites (the two-sheets copy icon beside the words, never the icon alone), not framed buttons; they still use a real `<button>` so keyboard and screen readers work, and they show the result in place (icon turns into a check, text into "Copied").
- **Secondary utility links (report a problem, feedback) are asides, not content:** a quiet link at the bottom right of the card, after the content and the main action in reading and tab order, never between the title, the details and the main action. In a card with an action row, put it in the same row (`.card-actions`, with `ms-auto`, so it wraps to the right); otherwise it is the card's last element (`.card-aside`).
- At most one primary button per card or form. Order: primary first, then secondary.
- A control that is not available is hidden, or disabled with a visible reason; it is not left clickable and silent.

## 2. Spacing and layout

- **Vertical rhythm comes from containers, not from margins on single elements.** The page column (`.page`) spaces its children with `space-y-10` (40 px); inside a section use `space-y-4`, inside a card `space-y-3`, and for a row of items `flex flex-wrap` with `gap-2` (chips, badges) or `gap-3` (buttons).
- **An Astro island (`client:load`, `client:visible`) renders as `display: contents`**, so it is invisible to its parent's `space-y`. Wrap every island that sits directly in the page column in a plain `<div>`, or the section above and below it touch (this happened with Search inside PDFs; `book-search.spec.ts` measures the gaps).
- Use the Tailwind spacing scale; no pixel values, no spacer elements, no `<br>`.
- Content never scrolls sideways: rows `flex-wrap`, long words and URLs may wrap, and every new page or component is checked at a 375 px width (Playwright: `scrollWidth <= clientWidth`).
- Every control is at least 44 px tall and wide (`min-h-11`), with room between neighbours so a thumb hits the right one.

## 3. Headings, text and colour

- One `h1` per page. Headings go down one level at a time (`h2` for a section, `h3` inside it, `h4` for the title of a card inside an `h3` section); never pick a level for its size, style it with a class.
- Colors come from the tokens in `global.css`; no new hex values. `--grey` (#959897) is never used for text or control borders (it fails contrast). Information is never carried by color alone.
- Set `lang` on text whose language differs from the interface (titles, snippets, tags), so screen readers and Burmese line-height rules apply.
- Numbers (counts, page numbers) are written with Latin digits in every interface language (`formatCount`).

## 4. Words and translations

- Sentence case, short, plain; the same thing has the same words everywhere: **Open PDF**, **Download PDF**, **Copy citation**, **Try again**, **Show more**, **Search**. Look for an existing message key before writing a new one.
- All visible text is a message key in `en.json` and `my.json`, never a string in a component. A new Burmese text is flagged in the PR as needing a Burmese reader's review. Never copy teachings; keep titles and Pāḷi diacritics exact.
- Say what the reader can do next in an error ("You can still search titles and tags above"), never only what went wrong, and never show technical details or codes.

## 5. States: every control that waits has all of them

Anything that loads or can fail has four visible states, each tested:

1. **Loading**: say so in words (`aria-live="polite"`), keep the layout still.
2. **Empty**: say it plainly and suggest what to try.
3. **Error**: a short message and a **Try again** button; never wipe what is already on screen because one later request failed (a failed "Show more" keeps the pages shown).
4. **Success**: the result, with its source or limit stated where it matters (OCR text may contain mistakes; the page number is the PDF's own).

Core content works with no login and, where possible, with no JavaScript; a feature that needs JavaScript or a service says so, and the page around it keeps working when it is down.

## 6. Forms and search

- A visible label above the field; the placeholder is an example, never the label.
- Enter submits. Requests to a service are sent on submit, never on every keystroke; searches that run in the browser may update as the reader types.
- The query lives in the address (`?q=`, `?pdf=`) so a search can be shared and survives a language switch; other parameters are preserved.
- Nothing the reader types is sent to analytics or logs: events carry a count range and a script label, never the words (docs/analytics.md).

## 7. Calm by design

No streaks, badges for achievement, counters that invite comparison, autoplay, pop-ups or animation beyond a short transition. The `.badge` class is for facts, not for rewards.

## 8. Reuse, then verify

- Use the existing classes and components first (`.btn`, `.card`, `.chip`, `.badge`, `.field`, `.link`, `Button`). Add a new class only when a second place needs it, and add it to the table in §1.
- Before opening a PR for a visual change: look at it (a screenshot at desktop and at 375 px width), in English and Burmese, and with the service stubbed as down. Add a browser test for anything that was wrong and could come back.
- If a reviewer or the maintainer finds a new kind of inconsistency, add the rule here in the same PR that fixes it.
