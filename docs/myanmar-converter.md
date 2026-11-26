# Burmese font converter (Unicode, Zawgyi, Win Innwa)

**Status:** proposed 2026-11-25. The package (stage 2) was built on 2026-11-25 in `packages/myanmar-convert` ([its README](../packages/myanmar-convert/README.md)); the mini app is not built yet. Research and decisions are below; the staged plan is in [implementation-plan.md](implementation-plan.md) §5F. It is the second mini app planned in [meditation-bell.md](meditation-bell.md) (its tile shows "Coming later" until this ships).

**Why:** much Burmese text that Win Metta's community works with is not Unicode. Older Dhamma books, class handouts and newsletters were typed in **Win Innwa** (1990s–2000s desktop publishing) or **Zawgyi** (phones and the web until about 2019), and some print layouts are still made in Win Innwa. Such text shows as gibberish, cannot be searched and cannot be pasted into the site, a Dhamma Post or most modern apps. Teachers and volunteers today use ad-supported converter websites that each handle only some directions. A free converter that runs in the browser, sends nothing anywhere and handles all three encodings in every direction serves the monastic community and costs almost nothing to host.

This adds two things:

1. **`@winmetta/myanmar-convert`:** a small TypeScript package in this repository (`packages/myanmar-convert`) that converts between Unicode, Zawgyi and Win Innwa. The site, book search and later other projects use it. It can be published to npm once it is stable (section 9).
2. **The font converter mini app** at `/<locale>/mini-apps/font-converter/`: paste or type text, choose what it is and what you want, copy the result.

---

## 1. Decisions (proposed 2026-11-25)

| Decision | Choice | Notes |
| --- | --- | --- |
| Where the code lives | **A workspace package in this repository**, `packages/myanmar-convert` | Two users here already (the mini app, book search); one PR can change the package and the page. A separate repository adds releases and a second CI for no gain yet. It can be split out with its history later (section 9). |
| Libraries | **One library per direction**, not several mixed | Mixing libraries makes the same text convert differently depending on the path. Section 4. |
| Conversion path | **Always through Unicode:** source → Unicode → target | Win Innwa ↔ Zawgyi needs no table of its own, and only four converters need testing. |
| Fixes | **In the wrapper, never inside a library** | Pre- and post-processing steps in the package, each with a test that shows the input it fixes. No edits under `node_modules`, no patch files. Real library bugs go upstream. |
| Detection | **Zawgyi is detected; Win Innwa is chosen by the user** | Win Innwa text is plain ASCII (`jrefrm` shows as မြန်မာ only in the font), so no detector can tell it from English. Section 5.3. |
| Where it runs | **In the browser only** | No server, no upload, no storage of the text. The converters load only on the converter page. |
| npm | **Later**, after the mini app has been used and the tests have settled | Section 9. |

Out of scope: converting whole files (Word, PDF, Excel), other legacy fonts (Ayar, CE, Matrix, Myanmar1) unless the libraries already cover them, Shan, Mon and Karen text, transliteration (Burmese ↔ Latin), spelling correction, and changing what the site itself accepts: site content stays Unicode-only ([tech-architecture.md](tech-architecture.md) §5).

---

## 2. The three encodings

| Encoding | What it is | Where it is found | Can it be detected? |
| --- | --- | --- | --- |
| **Unicode** | The standard Myanmar block U+1000–U+109F, in the order the syllable is spoken. Fonts: Noto Sans Myanmar, Pyidaungsu, Myanmar Text. | Everything modern, this site | Yes (it is the default) |
| **Zawgyi** | Uses Myanmar code points but in visual order and with its own glyph code points (U+1060–U+1097 reused). Needs the Zawgyi-One font. | Phones, Facebook and web text from about 2007 to 2019; filenames and text layers in the library | Yes, mostly: Google's detector plus the impossible-in-Unicode markers in `zawgyi.ts`. Pāḷi with stacked consonants can look like Zawgyi. |
| **Win Innwa** family | ASCII and Latin-1 bytes drawn as Burmese glyphs by the font. The family (WinMyanmar Systems, 1992–2005) includes Win Innwa, Win Researcher, Win Kalaw and others, which share one keyboard mapping. | Word documents, PDFs and print layouts from government offices, publishers and monasteries; the "legacy font" pages found by book search | **No.** Without the font name the text is just Latin letters. |

Unicode → Zawgyi and Unicode → Win Innwa cannot be exact for every text: both are glyph encodings and some Unicode sequences have no single correct glyph form. The app says so (section 6).

---

## 3. Existing tools (researched 2026-11-25)

**Libraries:**

| Library | Language | Directions | License | Activity on 2026-11-25 |
| --- | --- | --- | --- | --- |
| [google/myanmar-tools](https://github.com/google/myanmar-tools) | JS, Java, C++, PHP, Ruby, Python | Zawgyi ↔ Unicode (CLDR rules), Zawgyi detector | Apache-2.0 | 269 stars; last push 2025-03. Already used here at **1.1.3**: 1.2.0 on npm ships unbuilt sources ([tech-architecture.md](tech-architecture.md) §5). |
| [greenlikeorange/knayi-myscript](https://github.com/greenlikeorange/knayi-myscript) | JS with TypeScript types | Zawgyi ↔ Unicode, **Win Innwa family → Unicode** (since 2.10.0, PR #68 merged 2026-10-03), detection, syllable breaking, normalization | MIT | 82 stars; last push 2026-11-07; npm 2.10.0. Peer dependency `myanmar-tools >=1.1.2 <1.2.0`, which matches our pin. |
| [trhura/python-myanmar](https://github.com/trhura/python-myanmar) | Python | Every direction between Unicode, Zawgyi and Win Innwa | MIT | 75 stars; last push 2025-08 |
| [kanaung/converter](https://github.com/kanaung/converter) | PHP | Rule files for Win Innwa, Ayar, Zawgyi, Myanmar3 | MIT | 18 stars; last push 2019 |
| [Rabbit-Converter/Rabbit](https://github.com/Rabbit-Converter/Rabbit) | JS (also Node, PHP, Java, Python) | Zawgyi ↔ Unicode | WTFPL | 188 stars; simple regular-expression rules |
| [aungkkmo/mm-converter](https://github.com/aungkkmo/mm-converter) | Python | Win Innwa and Zawgyi → Unicode | MIT | A small wrapper around myanmar-tools and python-myanmar |

Older or unmaintained, for reference only: [mapmeld/my-winresearcher](https://github.com/mapmeld/my-winresearcher) (Win Researcher → Unicode, 2017), [scriptive/burglish](https://github.com/scriptive/burglish) (MIT, 2018), [Zwenexsys/parabaik](https://github.com/Zwenexsys/parabaik) (LGPL, 2014), [thanlwinsoft/firefoxmyext](https://github.com/thanlwinsoft/firefoxmyext) (2011). Outside JavaScript, ICU's `Zawgyi-my` transform (CLDR) converts Zawgyi to Unicode; browsers do not include it.

**No JavaScript library converts Unicode → Win Innwa.** That direction has to be built (section 4).

**Websites and apps:** Zawgyi ↔ Unicode converters such as [Myanmar House](https://www.myanmarhouse.com.mm/en/tools/myanmar-font-converter), [zawgyiunicodeconverter.com](https://zawgyiunicodeconverter.com/), [myanmartools.org](https://myanmartools.org/zawgyi-unicode-converter/) and [Pyidaungsu Institute](https://pyidaungsuinstitute.org/fontconverter/); [Pixelfun](https://pixelfun.art/font-converter) (Unicode → Win Innwa for Photoshop) and [iloveunicode](https://iloveunicode.com/tools/zawgyi-to-unicode) (Win Innwa → Unicode); the Windows tools KaNaung Converter and NLP Converter V2, listed at [mmunicode.org.mm](http://mmunicode.org.mm/converters/). Most are ad-supported, it is often not clear whether the text is sent to a server, and none we found covers all six directions.

---

## 4. How each direction is done

| Direction | Done by | Notes |
| --- | --- | --- |
| Zawgyi → Unicode | `myanmar-tools` 1.1.3 `zawgyiToUnicode` | Already a dependency; the same converter the library manifest uses |
| Unicode → Zawgyi | `myanmar-tools` 1.1.3 `unicodeToZawgyi` | Same library, so the two directions agree |
| Win Innwa → Unicode | `knayi-myscript` 2.10.0 `fontConvert(text, 'unicode', 'win')` | The only maintained JavaScript option |
| Unicode → Win Innwa | **Our own table**, ported from `trhura/python-myanmar` (MIT), checked against kanaung's rule files | Credited in the package's `NOTICE` (section 8) |
| Win Innwa ↔ Zawgyi | Through Unicode | No separate table |

**knayi-myscript was compared with python-myanmar** for Win Innwa → Unicode on 2026-11-25. The 1,860 Burmese library titles without Latin letters were converted to Win Innwa with this package, then read back by each. knayi gave back 1,848 unchanged, python-myanmar 1,143: python-myanmar reads Win Innwa's `0` as the digit, not wa, misreads tall aa (`g`) and leaves some marks as Latin letters, and its table has gaps (empty entries, a zero-width space in one stacked letter). knayi stays for this direction. For Unicode → Win Innwa, knayi's table (which covers every Win Innwa 4 code point) is read in reverse, and python-myanmar's rules choose the glyph variants.

Library choices are pinned to exact versions and updated through Dependabot PRs that must pass the test set.

---

## 5. The package: `@winmetta/myanmar-convert`

### 5.1 Interface

```ts
type Encoding = 'unicode' | 'zawgyi' | 'win-innwa';

convert(text: string, from: Encoding, to: Encoding): ConvertResult;
detect(text: string): Detected; // 'unicode' | 'zawgyi' | 'unsure' | 'no-myanmar'
```

- `ConvertResult` holds the text and notes for the caller to show: for example "this text looks like Unicode already", or "some characters have no Win Innwa form and were left as they are".
- `convert` with `from === to` returns the text unchanged. Text with no Myanmar letters is returned unchanged unless the source is Win Innwa (which is ASCII by nature).
- Win Innwa → Unicode is converted line by line, because knayi trims the text it converts; each line's leading and trailing spaces are put back, so indentation and blank lines survive.

### 5.2 Layout

- `src/convert.ts`: routing through Unicode and the pre- and post-processing steps.
- `src/zawgyi.ts`: the Zawgyi markers, detector thresholds and `fixZawgyiTitle`, **moved from `apps/web/src/lib/zawgyi.ts`** (deleted), plus `classifyZawgyi`, the same two-gate rule without converting. Its importers use the dependency-free subpath `@winmetta/myanmar-convert/zawgyi`, so library search and the Dhamma Post checks do not load the converters: `apps/book-search/src/quality.ts`, `scripts/generate-library-manifest.mjs`, `scripts/import-teachers.mjs`, `apps/web/src/components/LibrarySearchIsland.tsx`, `apps/web/src/lib/posts/validate.ts` and `apps/web/src/lib/posts/tags.ts`. Behaviour did not change; `zawgyi.test.ts` moved with it.
- `src/google.ts` and `src/zawgyi-fixes.ts`: myanmar-tools, created on first use, and the two fixes around it (section 5.4).
- `src/win-innwa/`: `glyphs.ts` (the Unicode → Win Innwa table), `from-unicode.ts` (reads each Unicode syllable and writes it in Win Innwa typing order) and `to-unicode.ts` (knayi).
- Unicode output is NFC. knayi already writes each syllable in Unicode storage order, and myanmar-tools follows the CLDR rules, so no further normalization step was needed.
- No imports from `apps/*`, no DOM, no Node-only APIs, so it runs in the browser, in Node scripts and on Lambda, and can be moved to its own repository or published unchanged.

### 5.3 Detection rules

- **Zawgyi:** the existing two-gate rule from `zawgyi.ts` (detector probability at least 0.9 **and** a marker impossible in Unicode). A high score without a marker, which is usually Pāḷi, gives `unsure`, never an automatic conversion.
- **Win Innwa:** never detected. In the app the user picks it. A later improvement could offer a hint ("this looks like Win Innwa text") when a mostly-Latin text is pasted into a page whose source is set to Unicode, but it never converts by itself.

### 5.4 Adjustments

Each fix is a small named step with a comment saying what it fixes and a test with the failing input. Fixes that belong in a library are also reported upstream with the test case. Found while building the package (2026-11-25), both in myanmar-tools 1.1.3, in `src/zawgyi-fixes.ts`:

- **Unicode → Zawgyi puts ေ after a stacked consonant** (`ဒၵေ` for ဒ္ဒေ, where Zawgyi needs `ေဒၵ`), so a Zawgyi font draws it on the next letter and converting back gives နိဒ္ဒသေ for နိဒ္ဒေသ. Correct Zawgyi looks the same when the ေ belongs to the next letter (ဓမ္မစေ), so the output cannot be repaired afterwards: each such syllable is converted on its own and its ေ moved to the front.
- **Zawgyi → Unicode reads a lone ၄ before a space as ၎**, so "အပိုင္း ၄" (part 4) became "အပိုင်း ၎". A lone ၄ is hidden from the converter and put back; ၄ followed by င (how Zawgyi typists write ၎င်း) still converts.

Reporting both to google/myanmar-tools is a follow-up.

---

## 6. The mini app

Built on the mini apps foundation ([meditation-bell.md](meditation-bell.md) §2): registry entry, `MiniAppShell.astro`, footer Feedback button, `PUBLIC_MINI_APPS` flag.

- **Layout:** a "From" choice (Auto: Unicode or Zawgyi, Unicode, Zawgyi, Win Innwa), a swap button, a "To" choice (Unicode, Zawgyi, Win Innwa), the input box and the output box side by side on desktop and stacked on phones, and Copy and Clear as text actions. Converts as you type, with a short delay for long text.
- **Auto** detects Unicode or Zawgyi and says what it found ("Looks like Zawgyi"). When it is unsure, it says so and asks the user to choose.
- **Showing the output:** the site does not ship the Zawgyi or Win Innwa fonts (their licences are unclear). Zawgyi and Win Innwa output is shown as plain text with a note: "This looks wrong here; paste it into a document that uses the Win Innwa (or Zawgyi-One) font." Unicode output is shown in Noto Sans Myanmar.
- **Notices:** when converting to Zawgyi or Win Innwa, a short note that these encodings cannot show every Unicode text exactly; when text already looks like the target encoding, a note before converting it again.
- **Size limit:** about 200,000 characters, with a message, so a mistaken paste does not freeze the page.
- **Privacy:** the text never leaves the browser and is not stored. The page says so.
- **Language:** fully translated like other site pages; unlike the meditation bell, its users are mostly Burmese readers working with Burmese text. To be confirmed (section 11).
- **Analytics:** at most one event when a conversion is copied, with the two encodings and a length bucket, added through [analytics.md](analytics.md) §3 first. Never the text, never the detector's verdict on a particular text. Whether to add it at all is an open question.

---

## 7. Tests and the quality set

- **Reference pairs:** Google's Zawgyi/Unicode pairs from myanmar-tools, and knayi-myscript's published test sets where their licence allows copying them into the repository.
- **Win Innwa samples:** text typed in Win Innwa with known Unicode equivalents, made by a volunteer who has the font (for example a page typed in Word with Win Innwa, then retyped or checked in Unicode). Pages from library books with "legacy font" text layers ([book-search.md](book-search.md) §4) are a second source, checked by a Burmese reader.
- **Pāḷi:** words with stacked consonants and kinzi (ဓမ္မ, ပတ္တိ, မင်္ဂလာ, ဗုဒ္ဓ, သင်္ဃ) in every direction, and the about 140 library titles that the Zawgyi detector scores high but are Unicode: they must come back unchanged from Auto.
- **Round trips:** Unicode → Zawgyi → Unicode and Unicode → Win Innwa → Unicode return the original for the whole set, with any known exception listed by name.
- **Golden file:** the expected output of every sample is committed, so a library update that changes any result fails CI and is reviewed.
- **Browser tests (Playwright):** the page in both locales, Auto with Zawgyi and with Pāḷi Unicode, swap, copy, the size limit, and a check that no request carries the text.
- **Reader review:** a Burmese speaker who knows Pāḷi checks a sample of every direction before go-live.

---

## 8. Licences and credits

- `myanmar-tools` (Apache-2.0) and `knayi-myscript` (MIT) are dependencies and keep their own licence files.
- The Unicode → Win Innwa table ported from `trhura/python-myanmar` (MIT), and anything taken from kanaung's rule files (MIT), keep their copyright and licence text in the package's `NOTICE`, with the source commit.
- The converter page has a short "Built with" note naming the libraries, with links.
- The Win Innwa and Zawgyi fonts are not included anywhere.

---

## 9. Publishing to npm (later)

Publishing a single workspace package from this repository works the same as from its own repository; only the package folder is published. It is done once the mini app has been in use for a while and the test set has settled, and each release is a public release that needs the maintainer's approval.

- **Package changes:** remove `"private": true`; build to `dist/` (JavaScript plus `.d.ts` types) and point `exports` there; `files` limited to `dist`, `README.md`, `LICENSE` and `NOTICE`; real versions starting at 0.1.0; `repository` with `directory: "packages/myanmar-convert"`; `publishConfig.access: "public"`. Inside the repository, the apps keep using the workspace copy, never the npm one.
- **Releasing:** a GitHub Actions workflow publishes on a tag such as `myanmar-convert-v0.1.0`, using npm **trusted publishing** (the workflow signs in through GitHub's OIDC token, so no npm token is stored) with provenance. Versions are bumped by hand at first.
- **Name:** `@winmetta/myanmar-convert` needs a free npm organization named `winmetta`, owned through an organization group address (details in the private repository, not here). Whether the name is free was not confirmed on 2026-11-25. If it is taken, an unscoped name is used instead.
- **Moving it to its own repository** later, if outside projects need it, is a `git subtree split` (or `git filter-repo`) of `packages/myanmar-convert`, which keeps its history.
- **Giving back:** the Unicode → Win Innwa direction could be offered to knayi-myscript upstream instead of, or as well as, publishing our own package.

---

## 10. Book search (later, optional)

Book search sends "legacy font" pages to OCR today ([book-search.md](book-search.md) §4), which is slow (about 6 seconds a page). If many of those pages turn out to be Win Innwa, converting their text layer with this package would be faster and could be more accurate. That needs its own measurement on the pilot books (text layer converted vs OCR) and its own plan; it is not part of this one. Zawgyi text layers could be handled the same way.

---

## 11. Open questions

- **Name and address:** "Burmese font converter" and `/mini-apps/font-converter/` (Myanmar users usually call this a "font converter"), or another name; and its Burmese name.
- **Language rule:** fully translated (proposed), or the meditation bell's English-buttons rule ([meditation-bell.md](meditation-bell.md) §7).
- **Win Innwa samples:** who can type or provide Win Innwa text with checked Unicode versions.
- **Analytics:** whether to count conversions at all (section 6).
- **npm organization:** whether to create the `winmetta` npm organization, and who owns it, before publishing (section 9).
