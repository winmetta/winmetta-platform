# Design guide

Rules for the look and behaviour of the site, so that every page, and every feature added later by a person or an AI agent, feels like the same product. The visual tokens (palette, fonts) are in [AGENTS.md](../AGENTS.md) §6 and `apps/web/src/styles/global.css`; this guide says how to use them. When a rule here and the code disagree, fix whichever is wrong in the same change.

Principles behind every rule: calm and legible, nothing that pulls attention for its own sake, the same thing always looks and is worded the same way, and a reader with a slow phone, a small screen or a Burmese interface is never an afterthought.

## 1. Clickable or not, and button or not

A reader decides what to tap by how a thing looks, so **only things that do something may look like they do something**, and **the look says what kind of thing it is.** If clicking an element does nothing, it must be a badge or plain text.

### Decide what it is

Ask in this order and stop at the first yes:

1. **Does it only show a fact** (a count, a state, a page number, a size)? A **badge**. Never clickable, never styled as clickable.
2. **Does it take the reader to another page** (or to a file's own page)? A **link**.
3. **Does it submit a form, or get or start something for the reader** (download or open a file, join a meeting)? A **framed button**: filled (`.btn-primary`) for the one main submit of a page or form, outline (`.btn-outline`) for the card's own action in a list (Download PDF, Open PDF at this page).
4. **Does it only act on what is already on screen** (copy, clear a search, remove a filter, reset, try again, show more, print)? A **text action**: the usual symbol, then the words, in the link color, with no frame. It is still a real `<button>` in the HTML.
5. **Is it a folder name** (a library folder, which is also a tag)? The **folder symbol before the name**, always: a clickable one is a **text action** (it filters the page in place), a folder row in the tree is a **link**, and the active filter is a plain label (`.folder-name`) with a **Remove** text action beside it. Never a filled pill.
6. **Is it a clickable topic tag** of another kind (a Dhamma post topic)? A **chip**.

If a control seems to need a frame to be noticed, the layout is the problem, not the control.

| Element | Class | Examples | Never for |
| --- | --- | --- | --- |
| Primary button | `.btn .btn-primary` | Search (submit) | Status, labels, repeated down a list |
| Outline button | `.btn .btn-outline` | Download PDF, Open PDF at this page, View app | In-place operations, information |
| Text action | `.text-action` (React: `TextAction` with an icon from `icons.tsx`) | Copy citation (copy icon, then a check and "Copied"), Clear search and Remove folder filter (×), Try again (retry arrow), Show more (chevron) | The main action of a card, navigation |
| Link | `.link` (brand color, semibold, no underline until hover) | Going to another page | Actions that change the page |
| Quiet link | `.link-quiet` in a `.card-aside` or `.card-actions` row | Something wrong? | Content, or anything the reader came to do |
| Folder name | `.folder-name` (symbol and name), as a text action, a tree link or a label | Dhamma Library folders in result cards, "Try these folders", the folder tree, the active filter | A filled pill or chip |
| Chip | `.chip` | A clickable Dhamma post topic | Folders, anything that is not clickable | Anything that is not clickable |
| Badge | `.badge` | PDF page 60, Read by OCR, 5.4 MB, a count | Anything clickable |

Rules that follow:

- A badge has no pointer cursor, no hover state and no `title`-only meaning: if it carries information a reader needs, the words are visible on the page (tooltips do not exist on touch screens).
- Do not turn a chip into a badge by removing its link, or a badge into a chip by adding a click. Change the class with the behaviour.
- Text actions use the symbol readers know from other sites, always with words beside it (never the icon alone), and show their result in place (the icon turns into a check, the text into "Copied"). Symbols come from `components/icons.tsx` (or the same paths inline in an Astro file); add a new one there.
- **Secondary utility links (report a problem, feedback) are asides, not content:** a quiet link at the bottom right of the card, after the content and the main action in reading and tab order, never between the title, the details and the main action. In a card with an action row, put it in the same row (`.card-actions`, with `ms-auto`, so it wraps to the right); otherwise it is the card's last element (`.card-aside`), rendered only when the feature is on, so a card without it has no empty wrapper and no extra gap.
- **The same action looks the same everywhere.** Getting a library PDF is an outline button in the catalog and in a search result, in the same place in the card's action row, followed by its small extras (the size badge, the copy action). A filled `.btn-primary` is for the one main action of a page or a form, not repeated down a list. Before adding a control, find the existing one for the same action and copy it.
- At most one filled button per card or form. Order in a row: the button first, then text actions, then the quiet link at the right.
- A control that is not available is hidden, or disabled with a visible reason; it is not left clickable and silent.
- Known controls still to bring in line with this section (migrate them when a page is touched): Print and Share on posts, the feedback dialog's Cancel.

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
