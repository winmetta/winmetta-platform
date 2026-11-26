# Design guide

Rules for the look and behaviour of the site, so that every page, and every feature added later by a person or an AI agent, feels like the same product. The visual tokens (palette, fonts) are in [AGENTS.md](../AGENTS.md) §6 and `apps/web/src/styles/global.css`; this guide says how to use them. When a rule here and the code disagree, fix whichever is wrong in the same change.

Principles behind every rule: calm and legible, nothing that pulls attention for its own sake, the same thing always looks and is worded the same way, and a reader with a slow phone, a small screen or a Burmese interface is never an afterthought.

## 1. Clickable or not, and button or not

A reader decides what to tap by how a thing looks, so **only things that do something may look like they do something**, and **the look says what kind of thing it is.** If clicking an element does nothing, it must be a badge or plain text.

### Decide what it is

Ask in this order and stop at the first yes:

1. **Does it only show a fact** (a count, a state, a page number, a size)? A **badge**: plain muted text, with a symbol where it helps (a document before a file size, a book before a number of books). **No pill, no background, no frame**: a rounded filled shape reads as a button. Never clickable, never styled as clickable.
2. **Does it take the reader to another page** (or to a file's own page)? A **link**.
3. **Does it submit a form, or get or start something for the reader** (download or open a file, join a meeting)? A **framed button**: filled (`.btn-primary`) for the one main submit of a page or form, outline (`.btn-outline`) for the card's own action in a list (Download PDF, Open PDF at this page).
4. **Does it only act on what is already on screen** (copy, clear a search, remove a filter, reset, try again, show more, print)? A **text action**: the usual symbol, then the words, in the link color, with no frame. It is still a real `<button>` in the HTML.
5. **Is it a folder name** (a library folder, which is also a tag)? The **folder symbol before the name**, always: a clickable one is a **text action** (it filters the page in place), a folder row in the tree is a **link**, and the active filter is a plain label (`.folder-name`) with a **Remove** text action beside it. Never a filled pill.
6. **Is it a clickable topic tag** of another kind (a Dhamma post topic)? A **chip**.

If a control seems to need a frame to be noticed, the layout is the problem, not the control.

| Element            | Class                                                                                                                      | Examples                                                                                                                                                                 | Never for                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Primary button     | `.btn .btn-primary`                                                                                                        | Search (submit)                                                                                                                                                          | Status, labels, repeated down a list              |
| Outline button     | `.btn .btn-outline`                                                                                                        | Download PDF, Open PDF at this page, View app                                                                                                                            | In-place operations, information                  |
| Destructive button | `.btn .btn-danger`                                                                                                         | Reset my settings                                                                                                                                                        | Anything that does not delete or clear saved data |
| Text action        | `.text-action` (React: `TextAction` with an icon from `icons.tsx`)                                                         | Copy citation (copy icon, then a check and "Copied"), Clear search and Remove folder filter (×), Try again (retry arrow), Show more (chevron)                            | The main action of a card, navigation             |
| Link               | `.link` (brand color, semibold, no underline until hover)                                                                  | Going to another page                                                                                                                                                    | Actions that change the page                      |
| Quiet link         | `.link-quiet` in a `.card-aside` or `.card-actions` row                                                                    | Something wrong?                                                                                                                                                         | Content, or anything the reader came to do        |
| Folder name        | `.folder-name` (symbol and name), as a text action, a tree link or a label                                                 | Dhamma Library folders in result cards, "Try these folders", the folder tree, the active filter                                                                          | A filled pill or chip                             |
| Chip               | `.chip`                                                                                                                    | A clickable Dhamma post topic                                                                                                                                            | Folders, anything that is not clickable           |
| Menu control       | `.menu-button` (the three-line symbol, which becomes a cross when open, then the word "Menu"; a text action in the header) | The phone navigation toggle                                                                                                                                              | Anything but the header                           |
| Badge              | `.badge` (plain muted text and symbol)                                                                                     | PDF page 60, Read by OCR, a count; a file size has a document symbol before it (`FileIcon`, or `LinkIcon name="file"` in Astro) and sits right after its Download button | Anything clickable                                |

Rules that follow:

- A badge has no pointer cursor, no hover state and no `title`-only meaning: if it carries information a reader needs, the words are visible on the page (tooltips do not exist on touch screens).
- Do not turn a chip into a badge by removing its link, or a badge into a chip by adding a click. Change the class with the behaviour.
- Text actions use the symbol readers know from other sites, always with words beside it (never the icon alone) and close to it (4 px, `gap-1`; folder names 6 px), and show their result in place (the icon turns into a check, the text into "Copied"). Symbols come from `components/icons.tsx` (or the same paths inline in an Astro file); add a new one there.
- **Secondary utility links (report a problem, feedback) are asides, not content:** a quiet link at the bottom right of the card, after the content and the main action in reading and tab order, never between the title, the details and the main action. In a card with an action row, put it in the same row (`.card-actions`, with `ms-auto`, so it wraps to the right); otherwise it is the card's last element (`.card-aside`), pinned to the card's bottom right corner with little space under it (CSS makes a card that has one a column and pushes the aside to the bottom, so cards of different heights in one grid row all end on the same line), rendered only when the feature is on, so a card without it has no empty wrapper and no extra gap.
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

### Header and navigation

- **Every menu link has an icon, everywhere.** Every first-level and submenu link in the wide header bar and in the phone menu has an outline icon before its words (`NavIcon.astro`: Classes with Sayadaws and Retreats, Dhamma Study Groups, Dhamma Library with Dhamma Apps and Digital Texts, Dhamma Posts, Mini Apps; Donate has an icon too but is out of the header for now; Settings uses the gear, `GearIcon.astro`). A new menu or submenu link needs an icon in `NavIcon.astro`.
- **Dropdown arrow:** a drawn chevron (a rotated corner in CSS, in the muted text colour), never a ▾ text glyph, which was too small and read as a dot. It shows on the wide bar only; the phone menu lists the submenu links open.
- **Phone menu:** below 48 rem, with JavaScript, a Menu button (three lines and the word) shows and hides the navigation; without JavaScript the links stay visible. Settings moves into the menu as gear and word after the last first-level link, and the header gear is hidden then (without JavaScript the gear stays and the menu entry is hidden, so there is never a duplicate).
- **Language switch and Settings gear:** the switch is its own sand pill (`.segmented`), compact at every width (40 px buttons, small text), and the gear is a separate round icon (`.header-icon`) beside it. Both sit in one plain wrapper (`.header-tools`, no background) so they always wrap to the next line together, never apart.
- **The language switch changes only the locale segment of the address** and saves the choice (see the language rule in AGENTS.md and the Settings page); the root `/` opens the saved language.
- **Class names are shared:** the gear's class is `.header-icon`, not `.icon-link`, because `.icon-link` is the symbol-plus-text link used in cards (§8).

## 3. Headings, text and colour

- One `h1` per page. Headings go down one level at a time (`h2` for a section, `h3` inside it, `h4` for the title of a card inside an `h3` section); never pick a level for its size, style it with a class.
- Payment details a donor must notice first (the Zelle blocks on the Dāna page) use `.zelle-panel`: sky background with a brand edge, no hover, since it is information and not a control; the value to type or copy is `.zelle-address`.
- Colors come from the tokens in `global.css`; no new hex values. `--grey` (#959897) is never used for text or control borders (it fails contrast). Information is never carried by color alone.
- Set `lang` on text whose language differs from the interface (titles, snippets, tags), so screen readers and Burmese line-height rules apply.
- Numbers follow the interface language: Burmese digits in Burmese (၁၂ အုပ်, ၉.၅ MB), Latin digits in English (`formatCount`, `formatSize`; never `toString()` or a raw number in a message). A counted thing uses its counter after the number (books are `အုပ်`, not `စာအုပ်`). Dates, times and class schedules keep the Latin digits they were decided to have.

## 4. Words and translations

- Sentence case, short, plain; the same thing has the same words everywhere: **Open PDF**, **Download PDF**, **Copy citation**, **Try again**, **Show more**, **Search**. Look for an existing message key before writing a new one.
- All visible text is a message key in `en.json` and `my.json`, never a string in a component. A new Burmese text is flagged in the PR as needing a Burmese reader's review. Never copy teachings; keep titles and Pāḷi diacritics exact.
- **Secondary labels are short in both languages**, so they never take more room or attention than the content: Burmese often runs longer than English, so when the Burmese version of a secondary link or action is clearly longer, write a shorter one (the "Something wrong?" link is `အမှားပြင်ရန်`, not a full sentence). Check the Burmese page too: a secondary link should take well under a third of its row.
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

### Settings pages

Settings use the **row layout of macOS System Settings and Windows 11 Settings, not cards**: a flat list divided by hairlines (`.settings-list`), one row per setting (`.settings-row`) with its name as a bold title (`h2`, `text-xl font-bold`) and a short muted explanation on the start side (`.settings-text`) and its control on the end side: a segmented choice (`.segmented.settings-choice`, buttons with `aria-pressed`, as the post language picker) for a few options, a red `.btn-danger` (red outline and text, filled red on hover) for a destructive action such as Reset or Clear, never the blue outline of a normal action, a switch or checkbox for on/off. Rows have generous padding (`py-8`) and are separated by hairlines between rows only (none above the first or below the last), never boxed, shaded or rounded. On a narrow screen the control wraps under the text at full width. A reset needs no confirm dialog when it is cheap and reversible: it runs at once, the button is disabled (muted, `not-allowed`) whenever nothing is saved and after a reset, and a green `✓ …` line (`.settings-done`, `role="status"`) sits beside it, stacked below on a phone. A setting takes effect when changed (no Save button) and says so in a `role="status"` line; the Settings link is the header gear, which on a phone (when the Menu button shows) moves into the menu as gear and word after the last link; the page title carries the gear icon (`GearIcon`), the same one as the header link. Add a new setting as a new row, not a new card.

## 7. Calm by design

No streaks, badges for achievement, counters that invite comparison, autoplay, pop-ups or animation beyond a short transition. The `.badge` class is for facts, not for rewards.

## 8. Reuse, then verify

- **Before adding a CSS class, search for its name** (`rg "\.name\b" apps/web/src`, and in the markup): a shared name silently restyles every other use. `.icon-link` (symbol before a text link) once collided with a header gear icon and squashed every class card link; the gear is `.header-icon`.
- Use the existing classes and components first (`.btn`, `.card`, `.settings-row`, `.chip`, `.badge`, `.field`, `.link`, `Button`). Add a new class only when a second place needs it, and add it to the table in §1.
- Before opening a PR for a visual change: look at it (a screenshot at desktop and at 375 px width), in English and Burmese, and with the service stubbed as down. Add a browser test for anything that was wrong and could come back.
- If a reviewer or the maintainer finds a new kind of inconsistency, add the rule here in the same PR that fixes it.

## 9. Mini apps

Mini apps are small tools under `/<locale>/mini-apps/`, the meditation bell first. The full design is in [meditation-bell.md](meditation-bell.md) §2 and §7; these are the rules every mini app follows so they feel like one family (planned 2026-11-25; the listing page and layout are built, the bell's own controls are not yet).

- **Listing page:** a normal site page (header, footer, language switcher). Each mini app is a tile: its icon as a rounded square, 64 px, and its name below in the body font; a "Beta" or "Coming later" note as a `.badge`-style muted line, never a pill. A tile is one link (the whole tile), except a "Coming later" tile, which is not a link and does not look like one. Every tile comes from the registry (`lib/mini-apps.ts`), never hand-written markup.
- **Icons:** one set, designed in Canva from basic shapes (no stock elements): a rounded square with one flat background colour from the palette and one simple symbol, no text, gradients or shadows, legible at 32 px, light and dark. Source, export and licence rules: [meditation-bell.md](meditation-bell.md) §2.1.
- **Mini app layout (`MiniAppShell.astro`), not the site layout:** no site header, navigation, logo or site footer. A slim top bar with **"← Mini Apps"** (a real link to the listing, start side) and the compact language switch **EN | ကခဂ** (end side; `lang="my"`, accessible name "Myanmar", text vertically centred, checked in a screenshot because Burmese glyphs are taller). A slim footer with only the **Feedback** button (outline speech-bubble icon and the word; icon only on narrow phones, with an accessible name), which opens the site's feedback dialog.
- **Leaving with something running:** a mini app that holds running state (a timer, an active schedule) asks before "← Mini Apps" or a language switch leaves the page, and saves its state so coming back resumes it.
- **Alerts at the top:** confirmations, notices and errors that concern the whole app appear in one area at the top of the app, under its main mode switch, never at the bottom. Confirmations (amber, with buttons, `role="alertdialog"`) for anything that turns something off or replaces data; notices (green, `role="status"`) close after 4 seconds or with ✕. Field errors stay next to their field.
- **Language exception:** a mini app may keep its buttons and labels in English in both locales and translate only alerts, notices and errors, as the meditation bell does ([meditation-bell.md](meditation-bell.md) §7.1). It is still all message keys (the `my` value is the English text), every button has an icon next to its word, and it is a decision written in the mini app's own doc, not a default. The listing page is always fully translated.
- **Digits and day names:** Western digits for times, dates and numbers in both locales. Day labels use the longest form that fits the available width ("Monday", then "Mon", then "Mo"); messages and alerts always use the full name.
- **Narrow screens:** rows of equal buttons (days, presets) use `minmax(0, 1fr)` grid columns so nothing is pushed off screen; long labels end with an ellipsis. Check every mini app at 320 px as well as 375 px and desktop, in both locales, light and dark.
- **Calm (§7) applies in full:** no streaks, totals of time spent, badges or celebration animations. A bell may move a little when it rings; nothing else animates.
