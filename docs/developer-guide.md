# Developer Contribution Guide

How to set up, change and submit code for `winmetta-platform`. [CONTRIBUTING.md](../CONTRIBUTING.md) is the short version; this guide has the detail. Product scope lives in [prd.md](prd.md), architecture in [tech-architecture.md](tech-architecture.md) and phase checklists in [implementation-plan.md](implementation-plan.md). When this guide disagrees with those, they win.

## 1. Before you start

- This is a volunteer-run nonprofit teaching Theravāda Buddhism, and supports any Theravāda tradition. Treat teachings, teachers and Pāḷi/Burmese text with care: use correct titles (Sayadaw, Ven., U) and diacritics (Theravāda, Pāḷi, Tipiṭaka), and never paraphrase or "improve" doctrinal content.
- **This repo is public.** Git history is effectively permanent. Read [AGENTS.md](../AGENTS.md) §2 before your first commit.
- Check the current phase in the implementation plan. Don't build deferred features (analytics, backend or database, accounts, offline/PWA, `apps/desktop`, `apps/mobile`).

## 2. Setup

Start with the org-wide [developer setup](https://github.com/winmetta/.github#developer-setup) (workspace layout, required tools, `bootstrap-dev-env.sh`).

**macOS:** run `../.github/bootstrap-dev-env.sh` once for shared tooling (Homebrew, git, gh, shellcheck, shfmt, nvm, VS Code, Claude Code, Codex CLI). If it asks you to finish the Command Line Tools installer, do that and rerun it. Then run `./scripts/setup-local-dev.sh` from the repo root. It installs Node 24, the npm version pinned in `package.json`, locked dependencies and the Playwright Chromium browser. Both scripts are safe to re-run.

**Other systems:** install Node 24 (see `.nvmrc`), install the npm version in the `packageManager` field of `package.json`, then run `npm ci`.

No Docker, database or env file is needed. Run `npm run dev` and open <http://localhost:4321>.

## 3. Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | The only app: Astro static site with React islands. |
| `apps/web/src/i18n` | Locale registry, keyed messages (`messages/en.json`, `messages/my.json`), route helpers, localized-content fallback. |
| `apps/web/src/lib` | Zod schemas, schedule helper, library filter, site config. |
| `apps/web/src/fixtures` | Synthetic content used by the content collections in Phase 0. |
| `apps/web/tests` | Playwright smoke tests. |
| `scripts/setup-local-dev.sh` | Repo setup: Node, npm, dependencies, Playwright browser. |
| `infra/terraform/` | Phase 2 and later; not present yet. |

Keep code in `apps/web` until a second consumer needs it. Only then extract a package under `packages/`.

## 4. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 127.0.0.1:4321. Only one can run per project; a second start prints the URL and PID of the running one. `npm run dev -- --force` replaces it. |
| `npm run dev:stop` | Stop the running dev server. |
| `npm run lint` | ESLint plus a Prettier check. |
| `npm run format` | Format the repo with Prettier. |
| `npm run typecheck` | `astro check` (strict TypeScript). |
| `npm test` | Vitest unit tests. |
| `npm run build` | Static production build. |
| `npm run test:smoke` | Playwright tests against the built site (served on port 4331, so a running dev server on 4321 is never reused). Run `npm run build` first. The first time, run `npx playwright install chromium`. |

CI runs all of these on every pull request and does not deploy. Run lint, typecheck, test and build locally before pushing.

## 5. Configuration

`.env.example` documents the variables. For local overrides copy it to `.env.local` at the repo root (ignored by git) and restart the dev server.

- `SITE_URL`: origin for canonical and alternate-language URLs. Defaults to `http://localhost:4321`.
- `PUBLIC_ALLOW_INDEXING`: only the public production build sets this to `true`. Every other build sends `noindex`.

Never put secrets in `PUBLIC_*` variables, because they can appear in the generated site. Don't add `.env.staging` or `.env.production`; deployed environments use GitHub environment variables and secrets.

## 6. Coding conventions

- TypeScript strict mode. No `any`; use `unknown` and type guards.
- Styling with Tailwind utilities and shadcn/Radix primitives. Prefer logical properties (`ps-*`, `ms-*`) so layouts survive text expansion.
- **Look and feel:** use the design tokens and component classes in `apps/web/src/styles/global.css` (palette from the Win Metta Brand Kit in Canva; derived colors are documented there with their contrast ratios). Interactive elements keep a 44 px target and a visible focus ring. Links are not underlined (see AGENTS.md §6 for the rule and why inline links are semibold brand color). Check new colors for contrast before adding them.
- Design for mobile and desktop. Interactive elements need touch targets (`min-h-11`) and keyboard access, with visible focus. UI components need accessible names; the ESLint a11y rules run on `.tsx`.
- No vanity metrics (streaks, leaderboards, badges) or engagement-optimized patterns. No analytics SDKs.
- Core content must work without login.
- Keep the diff focused. Match the surrounding code's naming and comment density.

## 7. Internationalization

All user-facing text supports English (`en`) and Burmese (`my`).

- **Burmese terms:** "ဆရာတော်" is reserved for monks. Interface labels that can include any teacher (menu, filters, table headers, intros) say "သင်ကြားသူ" instead, and a lay teacher such as Daw Khin Hla Tin must never appear under "ဆရာတော်". Everyday English technical words (for example Zoom, Web Hosting) are kept beside or instead of rarely used Burmese terms when readers know the English better. "ဘုန်းကြီးကျောင်း" means a monastery; never use plain "ကျောင်း" (it can mean a school).
- **Messages:** add each key to `en.json` and `my.json`, and use `t(locale, key)`. The build fails on missing, empty or extra keys. Don't hardcode strings, branch on `locale === 'en'`, or concatenate sentences.
- **Burmese text** must be Unicode (U+1000–U+109F), never Zawgyi (the library generator converts legacy Zawgyi filenames and lists them in `zawgyi-review.json`). Have a Burmese speaker review wording.
- **New locale:** add it to the registry in `i18n/locales.ts` and add its message file.
- **Routes:** add a page ID to `pagePaths` in `i18n/routes.ts` and build links with `route(locale, page)`. Never link to a page that isn't built.
- **Locale switch rule:** switching language changes only the locale segment of the URL. Path, query, filters and fragment must stay intact, computed from the URL when the link is activated. Any new stateful navigation (search, filters) must keep this true and needs a Playwright test.
- Interface locale, resource language and timezone are separate. A Burmese UI doesn't translate a linked English book or change the schedule zones.
- Content missing in a locale falls back to the source language with a visible language label. Never present a fallback as a translation (`localizedContent` handles this).

## 8. Content and data

- Schemas are in `src/lib/schemas.ts`. Every record has a stable kebab-case `id`, a `sourceLanguage`, `translations` that include the source language, a `sourceUrl` and a `verifiedAt` date.
- Organize classes by the real class name, with a `curriculum` code and `teacher` as a separate field (see [AGENTS.md](../AGENTS.md) §3). Add a new curriculum to that table before adding its content.
- **Schedules** store the source IANA timezone and a local weekday/time (ISO weekday, Monday=1 to Sunday=7). Compute occurrences with `occurrenceOn` and show Pacific (`America/Los_Angeles`) and Myanmar (`Asia/Yangon`) by default. Don't compute with the browser's local zone. Nonexistent daylight-saving times are rejected and repeated times resolve to the earlier instant.
- **Library files** come from a generated manifest of the S3 bucket, not hand-written records (see [tech-architecture.md](tech-architecture.md) §3). Fix a title, author, language or tags in the overrides file, never by renaming S3 objects, and never edit the manifest by hand. Every folder in a file's path is a tag with its number prefix removed, and has a stable id in `folders.json` that its static page URL uses; never change or reuse an id. Search normalization treats ဥ/ဉ and Burmese/ASCII digits as equal; change it only with the golden-query tests. The generator command will be listed here when Phase 1 adds it.
- **Classes, study groups, teachers and retreats** are committed JSON in `apps/web/src/content/` (`classes.json`, `teachers.json`, `retreats.json`, `channels.json`) plus `zoom-help.json` for the Zoom help page. Edit `classes.json` by hand (set `streamed` per class; archived classes carry no schedule or Zoom details). Teachers and retreats are first imported from winmetta.org, then reviewed: `node scripts/import-teachers.mjs` (bios and portraits into `src/assets/people/`, recorded in `src/assets/SOURCES.md`; it keeps the English drafts and `reviewed` flags) and `node scripts/import-retreats.mjs` (dates, format, venue and teacher are authored in the script's event list; it reads each page for timetable PDFs, per-day post links and class notes; a session's day comes from its title or its position in the page's list, never from the WordPress post date, with reviewed overrides in `sessionDayOverrides`). Both are read-only against winmetta.org. Retreat photos are deliberately not imported (they show lay participants). Never copy volunteer phone numbers or e-mail addresses, registration forms, roster spreadsheets, chat invites or flyers with contact details. Set a teacher's English `reviewed` to `true` only after a Burmese speaker has checked it.
- **Phase 0 fixtures** are synthetic and use reserved domains (`example.invalid`). Keep them separate from real published content, which arrives in Phase 1.

## 9. Secrets and personal data

- Never commit secrets: API keys, tokens, connection strings, OAuth secrets, cloud credentials.
- No real personal data, even in fixtures: no student or roster names, emails, phone numbers or private meeting details. Use synthetic placeholders.
- The only exception is the already-public weekly class Zoom links and passcodes, which may appear in schedule content. Retreat or one-off session credentials, meeting host keys and anything not already published stay out.
- Review `git diff --cached` before every commit. If something sensitive was staged, stop and ask a maintainer before pushing. Don't try to hide it with a follow-up commit.
- Terraform (later): commit only `*.tfvars.example`.

## 10. Testing

- **Unit tests** (Vitest) sit beside the code as `*.test.ts`. Add them for helpers, especially schedule logic (daylight-saving and day-rollover cases) and library filtering (include Burmese text).
- **Smoke tests** (Playwright) cover routing, the language switcher, fonts and the React island on desktop and mobile viewports. Add a case when you change navigation or layout.
- The golden search tests in `library-search.test.ts` run against the real manifest. After regenerating it, a test can fail because a book it names was renamed or removed in S3 (for example `ဓမ္မပဒ`); update the test to a title that still exists, but never weaken an assertion to make it pass.
- A bug fix should come with a test that fails without it.

## 11. Git workflow

1. Branch from `main` (for example `feat/library-filter`). Don't push directly to `main`.
2. Make small commits using [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>`, with types `feat`, `fix`, `docs`, `refactor`, `chore` or `test`. Example: `fix(schedule): reject nonexistent DST times`.
3. Run lint, typecheck, test and build locally.
4. Open a pull request describing the purpose, what you changed and how you checked it. Include screenshots for UI changes, in both locales.
5. CI must pass. Address review comments with follow-up commits.

Don't force-push shared branches or rewrite published history.

## 12. Pull request checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass; `npm run test:smoke` passes if you touched UI or routing.
- [ ] New UI text exists in both `en` and `my`; no hardcoded strings.
- [ ] Layout checked at 320px and desktop widths, and by keyboard.
- [ ] No secrets, real personal data or non-public meeting details in the diff.
- [ ] Docs and the implementation-plan checklist updated if behavior or scope changed.
- [ ] Teacher names, titles and Pāḷi diacritics are correct; no doctrinal text paraphrased.

## 13. Getting help

Questions, content proposals or access issues: <contact@winmetta.org>, or open a GitHub issue.
