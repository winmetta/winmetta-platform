# @winmetta/myanmar-convert

Converts Burmese text between **Unicode**, **Zawgyi** and **Win Innwa** in every direction, in the browser or in Node. Design and research: [docs/myanmar-converter.md](../../docs/myanmar-converter.md). Not published to npm yet.

```ts
import { convert, detect } from '@winmetta/myanmar-convert';

convert('jrefrm', 'win-innwa', 'unicode'); // { text: 'မြန်မာ', notes: [] }
convert('မင်္ဂလာပါ', 'unicode', 'zawgyi'); // { text: 'မဂၤလာပါ', notes: [] }
detect('ျမန္မာစာ ေလ့လာျခင္း'); // 'zawgyi'
```

## How it converts

Every conversion goes through Unicode: source → Unicode → target. One library does each direction:

| Direction | Done by |
| --- | --- |
| Zawgyi → Unicode, Unicode → Zawgyi | `myanmar-tools` 1.1.3 (Google, CLDR rules), with two fixes in `src/zawgyi-fixes.ts` |
| Win Innwa → Unicode | `knayi-myscript` 2.10.0 |
| Unicode → Win Innwa | `src/win-innwa/` (no library does it) |

- **Win Innwa is never detected.** Its text is ASCII and Latin-1 (`jrefrm` is မြန်မာ only in the font), so the caller must say the source is Win Innwa.
- **Zawgyi is detected with two gates** (`src/zawgyi.ts`): the detector's score and a pattern impossible in Unicode must agree. Pāḷi with stacked consonants (ဓမ္မ) scores as Zawgyi but has no such pattern, so `detect` returns `'unsure'` and nothing is converted by itself.
- **Notes** (`ConvertResult.notes`) are codes for the page to explain: letters with no Win Innwa glyph kept as Unicode, Latin text in Win Innwa output, and a source that looks like the other encoding.
- `@winmetta/myanmar-convert/zawgyi` exports only the Zawgyi patterns, with no dependencies, for code that must stay small (library search, Dhamma Post checks, book search).

## Known limits

- Unicode → Zawgyi and Unicode → Win Innwa cannot be exact for every text: both are glyph encodings.
- Win Innwa types wa (ဝ) and zero (၀) with the same key, and သြ and ဩ alike, so a round trip through Win Innwa can change which of the two is used. knayi decides from the context (a zero inside a number stays a digit).
- The Win Innwa glyph variants (narrow or wide medial ra, short na, dot position) change only how the text looks in the font. They follow common Win Innwa text and have not yet been checked in the font by a reader.

## Checks

```bash
npm test --workspace @winmetta/myanmar-convert
npm run typecheck --workspace @winmetta/myanmar-convert
```

On 2026-11-25, of the 1,862 Burmese titles in the library manifest, 1,848 came back unchanged from Unicode → Win Innwa → Unicode and 1,854 from Unicode → Zawgyi → Unicode. The rest are the Win Innwa limits above or typos in the titles (a doubled ် or ာ, ေ typed in the wrong place), which conversion normalizes.

Credits and licences: [NOTICE](NOTICE).
