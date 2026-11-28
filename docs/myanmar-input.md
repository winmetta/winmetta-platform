# Burmese typing (`@winmetta/myanmar-input`)

**Status:** proposed 2026-11-27. Stages 1 to 3 (the core package, the DOM adapter, the shared field, the Settings rows, the events and the Privacy text, section 8) are built; no mini app uses the field yet. This is the design for a generic input package and its shared field, decided in conversation on 2026-11-27 while designing the Pāḷi Dictionary mini app ([pali-dictionary.md](pali-dictionary.md)). It is not specific to dictionary search: any place that lets a person type Burmese, or Pāḷi in Burmese script, should be able to use it. It is the input-side sibling of [myanmar-converter.md](myanmar-converter.md) and builds on `@winmetta/myanmar-convert`.

**Why:** people type Burmese in several ways: a Myanmar Unicode keyboard, a Zawgyi keyboard (older phones), or an English keyboard with a Win Innwa font, where each key is a glyph (`jrefrm` shows as မြန်မာ only in the font). Site text is Unicode-only ([tech-architecture.md](tech-architecture.md) §5), and library search lists "Zawgyi-typed search queries" as an unscheduled improvement (§10). One package that turns what was typed into clean Unicode, and says what it did, lets every Burmese field on the site accept all of these without each app re-solving detection, key order and Pāḷi stacking.

Pāḷi is written in Burmese script with stacked consonants, kinzi and a few extra letters (ဋ ဌ ဍ ဎ ဏ ဥ ဉ ဿ), and these are exactly what is hard to type on an English keyboard. That is why the package treats "Burmese or Pāḷi in Burmese script" as one job.

---

## 1. Decisions (proposed 2026-11-27)

| Decision | Choice | Notes |
| --- | --- | --- |
| Scope | **Generic.** No lookup, search, headword or dictionary vocabulary in the package | The dictionary applies its own key to the Unicode this package returns. |
| Where the code lives | **A workspace package**, `packages/myanmar-input`, `@winmetta/myanmar-input` | Created because sharing is real: the Pāḷi Dictionary plus at least one more field. Private, not published to npm yet. |
| Layers | **Core** (pure TypeScript, no DOM), **DOM adapter** (`./dom`), and the **shared React field** in `apps/web/src/components/ui` | The package returns codes, never sentences, and owns no styling, fonts, messages or analytics, like `myanmar-convert`. |
| Methods | **Auto** (default), **As typed** (Unicode), **Win Innwa** | Zawgyi typing is covered by Auto; a forced Zawgyi method is reserved, not built. |
| What an app stores | **Unicode only** | In Win Innwa mode the box holds raw glyph codes so the font draws them; apps submit and store the Unicode the package returns. |
| Where the choice lives | **Site-wide setting**, one key, a row on `/<locale>/settings/` | Decided 2026-11-27. A Win Innwa typist chooses once. Section 6. |
| Pāḷi stacking in Win Innwa | **Shift+F dead key** from pndaza's Keyman layout, plus an on-screen keys tray | Decided 2026-11-27 for now. The table comes from a third-party layout and is not yet checked with a native Win Innwa typist (section 5). |
| Canonicalizing | **One seam**, `canonicalize(text) → { text, fixes }`, backed by an interim file until `@winmetta/pali-text` ships | Section 7. |
| Where it runs | **In the browser only**; nothing typed is sent or stored by the package | |

Out of scope: converting pasted files (use the converter), other legacy fonts, Shan, Mon and Karen, transliteration (Burmese ↔ Latin, IAST), spelling correction, predictive text, and fields that are not Burmese text (email, URL, numbers).

---

## 2. Methods

| Method | The box holds | The package does |
| --- | --- | --- |
| **Auto** (default) | What the OS keyboard produces: Myanmar Unicode, Zawgyi, or Latin | Detect Unicode or Zawgyi, convert Zawgyi to Unicode, fix typing order, report what it did |
| **As typed** | Keys exactly as typed, taken as Unicode | Nothing. Apps may still normalize later (for example the dictionary key). |
| **Win Innwa** | Win Innwa glyph codes, shown in the Win Innwa font | `winInnwaToUnicode` from `myanmar-convert`; the dead-key engine; the keys tray |

### 2.1 How Auto decides

Auto is more than `detect()`. On a single word the detector says `unsure` for ဓမ္မ, `ျမန္မာ` and သတ္တ, and `convert(unicode → unicode)` leaves a leading ေ where it was typed (checked 2026-11-27). The rules, in order:

1. No Myanmar text: pass it through unchanged. If it is Latin, a note suggests Win Innwa mode (English keys typing Burmese).
2. **Zawgyi** when the existing two-gate rule says so ([tech-architecture.md](tech-architecture.md) §5: detector score at least 0.9 and a marker impossible in Unicode), or, for short text, when a marker alone is present: a leading ေ, ျ or ြ before a consonant, or code points U+1060–U+1097. Then Zawgyi → Unicode.
3. Otherwise treat it as **Unicode** and canonicalize it: mark order, a stack typed after a vowel, ဥ/ဉ confusion, duplicate marks, zero-width characters.
4. Still unsure (Pāḷi stacks look Zawgyi-like): treat it as Unicode, set `evidence: 'none'` and add the note `unsure`, so the page can offer "Search as Zawgyi" or its equivalent. A wrong guess costs one tap and never blocks anything.

`evidence` says how sure Auto was: `marker` (an impossible-in-Unicode pattern), `score` (detector only, long text) or `none`. Short input trusts markers only; longer text may also trust the score.

The field shows Zawgyi-typed text in the Zawgyi font only after a pause and only when Zawgyi is confident, so the font does not flip mid-word.

### 2.2 Changing method with text in the box

The text is converted to the new method's form, with a note when the conversion is lossy (Unicode → Win Innwa cannot be exact for every text; see [myanmar-converter.md](myanmar-converter.md)). The box is never cleared and never left to be misread.

---

## 3. The package

```ts
type InputMethod = 'auto' | 'unicode' | 'win-innwa'; // 'zawgyi' reserved

resolveInput(raw: string, options: {
  method: InputMethod;
  multiline?: boolean;
  canonicalize?: boolean; // default true
}): {
  unicode: string;                        // the only value an app should store or send
  source: 'unicode' | 'zawgyi' | 'win-innwa';
  evidence: 'marker' | 'score' | 'none';
  fixes: Fix[];                           // codes, e.g. 'moved-e', 'reordered-marks'
  notes: Note[];                          // codes, e.g. 'unsure', 'latin-in-win-innwa'
};

switchMethod(raw, from, to): { raw: string; notes: Note[] };
createKeyEngine(method): KeyEngine;       // pure: key event → insert | arm | cancel | pass
keyGroups(method): KeyGroup[];            // data: stacked, ligatures, independent, kinzi, punctuation
fontFor(method, result?): 'unicode' | 'zawgyi' | 'win-innwa';
```

- **Core** (`.`): everything above, no DOM, runs in Node and in browsers. Depends on `@winmetta/myanmar-convert`.
- **DOM adapter** (`./dom`): `attachInput(element, options)` for any `<input>` or `<textarea>`. Runs the key engine on `keydown`, handles paste (including pasted Latin-1 glyphs, which are kept as they are), inserts at the caret with `setRangeText`, and never rewrites text between `compositionstart` and `compositionend`, so phone keyboards (Gboard Myanmar and similar) are not disturbed. Dead keys act only in Win Innwa mode.
- **Not in the package:** the method picker, the keys tray, fonts, translated messages, storage of the choice and analytics. These live in the shared React field and the app.
- **Folder:** `src/index.ts`, `methods.ts`, `resolve.ts`, `auto.ts`, `keys.ts` (the dead-key and tray data), `interim.ts` (section 7), `dom.ts`, `*.test.ts`, a README and a `NOTICE`.

Constraints to put in the README:

- **Latin letters and Western digits cannot be typed in Win Innwa mode**: its keys are glyph codes, so letters and digits type Burmese. The package is not for email, URL or number fields.
- **Shift+F is the dead key**, so the raw `F` glyph (kinzi) is not reachable that way: kinzi is `f` `f` (as in pndaza's layout; `f` alone is asat) or a tray key.
- **Roman Pāḷi (IAST)** is not typed or converted here; that is `@winmetta/pali-text` transliteration.

---

## 4. The shared field

A React component in `apps/web/src/components/ui`, in the `mini-*` look ([design-guide.md](design-guide.md) §9), used by any island or mini app that takes Burmese text:

- the text field in the right font (`font-win-innwa` or `font-zawgyi` from `styles/burmese-fonts.css`; the Win Innwa file is already bundled for the converter), with `translate="no"`;
- the method choice (`.mini-choices`, three short options), bound to the site-wide setting (section 6);
- a caption under the box in the converter's style ("Shown in Win Innwa"), and, in Win Innwa and Auto modes, a line showing the Unicode the app will receive ("Using ဓမ္မ (Unicode)");
- an optional **keys tray** (a "Pāḷi keys" disclosure) that inserts Unicode in Auto and As typed and Win Innwa glyph codes in Win Innwa, per consumer option;
- notices from `fixes` and `notes` in one `role="status"` area ("Moved ေ after the consonant", "Not sure if this is Unicode or Zawgyi. Using Unicode.");
- `onChange({ raw, unicode, source, evidence, fixes, notes })`; apps read `unicode`.

Options per consumer, not package behaviour: which methods are offered, whether the tray shows, single or multiline, a length limit. The Pāḷi Dictionary shows the tray; a feedback box might not.

---

## 5. Win Innwa dead-key table

For now the table follows **pndaza's Keyman "smart" Win Innwa layout** (`source/wininnwa/WinInnwa.kmn` in `pndaza/myanmar-unicode-keyboard-layout`, third party, 2018), read and compared with `packages/myanmar-convert/src/win-innwa/glyphs.ts` on 2026-11-27. **It is not yet confirmed against the original Win Innwa driver or by a native Win Innwa typist; that check is deferred.** The repository carries no licence file, so no code is copied: only the key sequences (facts about which key gives which glyph), credited in the package's `NOTICE`.

Why it is needed: Win Innwa draws stacked Pāḷi consonants on Latin-1 code points (ဓမ္မ is `"r®`, သတ္တ is `owå`), which a plain English keyboard cannot type. The original driver uses Alt codes (Windows) or Ctrl+Alt (newer WinKalaw layouts). The package accepts pasted or typed Latin-1 glyphs as they are, adds the dead key, and offers the tray as a fallback.

**Stacking:** press **Shift+F**, then the key of the consonant to stack. A key not in the table cancels the dead key.

| Key after Shift+F | Stacked glyph | Key | Stacked glyph | Key | Stacked glyph |
| --- | --- | --- | --- | --- | --- |
| `u` | ú က | `p` | ö စ | `'` | ´ ဒ |
| `c` | © ခ | `q` | ä ဆ | `"` | ¨ ဓ |
| `*` | ¾ ဂ | `Z` | Æ ဇ | `e` | é န |
| `C` | ¢ ဃ | `Q` | Ñ ဈ | `y` `z` `A` `b` `r` `v` | Ü æ Á Ç ® ’ (ပ ဖ ဗ ဘ မ လ) |
| `#` | ³ ဋ | `X` | ² ဌ | `P` | Ö ဏ |

- **ta and tha** stack only after တ: Shift+F then `w` gives å, then `x` gives ¬ (ထ). After a short na, the layout writes them as Å (U+00C5) and ¦ (U+00A6). Our glyph table has å and ¬ only; check whether the bundled font has Å and ¦ and whether they matter for န္တ.
- **Ligatures** (one glyph each): after `#`, Shift+F `#` gives ¥ (ဋ္ဋ) and Shift+F `X` gives | (ဋ္ဌ); after `!`, Shift+F `!` gives × (ဍ္ဍ) and Shift+F `B` gives ¹ (ဍ္ဎ); after `P`, Shift+F `!` gives @ (ဏ္ဍ).
- **Kinzi:** `f` `f`.
- All 20 plain stack outputs and the 5 ligature outputs equal our `STACK` and `LIGATURE` tables.
- **Not adopted:** pndaza's 13 extra key remaps (`W`→zero, `E`→£, `Y`→þ, `U`→ဥ, `I`→kinzi, `O`→ဿ, `K`→ü, `L`→í, `B`→¡, `N`→Ú, `<`→ç, `.`→`.`, `>`→¿). In Win Innwa mode a key types its own glyph code, as the converter expects, so Shift+W types `W`. Revisit with a native typist.
- **Settings:** the dead key can be turned off (section 6).

---

## 6. The site-wide setting

Decided 2026-11-27: the method is one choice for the whole site, so it is a setting, and [design-guide.md](design-guide.md) §6 and `AGENTS.md` require a row on `/<locale>/settings/`, covered by Reset.

- **Storage:** one key, `winmetta.input`, JSON such as `{"method":"win-innwa","stackKey":true}`, validated with Zod. Missing, invalid or unreadable means Auto with stacking on. A small `lib/input-method.ts` in the app reads, writes and listens for the `storage` event, so other open tabs follow. The package never touches storage.
- **Rows:** "Burmese typing", a segmented choice (Auto, As typed, Win Innwa) with a muted explanation, applied at once with a `role="status"` line; and "Stack with Shift+F", an On/Off switch (default On) that is disabled with a muted note when Win Innwa is not chosen, keeping the saved value. Reset clears the key. New `en` and `my` messages; the Burmese is flagged for review.
- **In a field:** the field's picker writes the same setting, so there is one choice with two places to change it; the Settings row updates through the `storage` event. No per-field temporary override.
- **Applies only** to fields built on the shared component. Plain fields and the Burmese Text Converter's From choice are unaffected.
- **Storage blocked** (private mode): the choice lives in memory for the page view, and the row shows the existing "blocked" message.

---

## 7. Canonicalizing and `@winmetta/pali-text`

The Python dictionary tooling has a canonical syllable orderer (`canonicalize_myanmar_syllables` in `pali-myanmar-dictionaries/src/pali_myanmar_dicts/normalize.py`) and a TypeScript port is being built in `@winmetta/pali-text` ([the dictionary plan](https://github.com/winmetta/pali-myanmar-dictionaries/blob/main/docs/implementation-plan.md) §4.1). This package must not grow a second long-lived port. Until `pali-text` has a pinned release:

- `myanmar-input` calls `canonicalize` from **one** module. `interim.ts` holds a small tolerant implementation, checked against golden vectors generated from the Python functions: the dictionary fixture words, the key cases in §4.1 (`ဓမ္မ` / `ဓမမ`, `ပဉှ` / `ပဉဟ`, `သင်္ဃ` / `သံဃ`, `သဿတ` / `သသသတ`) and typing-order mistakes.
- Matching never depends on it. A dictionary applies its own key to the Unicode it receives, which canonicalizes again, so an interim difference changes only what the page says it fixed.
- When `pali-text` ships a tolerant canonicalizer that reports fixes (requirement R3 in the dictionary plan), the one import changes, `interim.ts` is deleted, and the shared vectors are the acceptance test. Removing it is an exit criterion, not a to-do.
- Dependency direction: `myanmar-input` depends on `myanmar-convert` and later on `pali-text`; neither depends on it.

---

## 8. Staged plan

1. **Core package (built 2026-11-27, `packages/myanmar-input`):** methods, `resolveInput`, Auto rules, `switchMethod`, key engine and key data, `interim.ts` with its vectors. Unit tests (section 9). No UI.
2. **DOM adapter** and a browser test of the dead key, paste and composition (built 2026-11-27: `src/dom.ts`, `tests/dom.spec.ts`, run in CI after the smoke tests).
3. **Shared field** and the **Settings rows**, events and Privacy paragraph (section 10) (built 2026-11-27: `apps/web/src/components/ui/MyanmarInputField.tsx`, `components/InputSetting.astro`, `lib/input-method.ts`, `lib/myanmar-input-events.ts`, `lib/myanmar-input-view.ts`; the Settings rows show only when `PUBLIC_MINI_APPS` is on), used first by the Pāḷi Dictionary mini app ([pali-dictionary.md](pali-dictionary.md)).
4. **Swap the canonicalizer** for `pali-text` and delete `interim.ts` (section 7).
5. **Adopt elsewhere,** each its own change and, for search, a Burmese-speaker review of the golden queries. Candidates, not checked: library, book and post search (tech-architecture.md §10 "Zawgyi-typed search queries"; the 0.9 threshold needs the same review), and other Burmese free-text fields such as the feedback form and typed answers in LLB practice. The Burmese Text Converter keeps its own From choice.

---

## 9. Tests

- **Auto:** one-word and sentence inputs in Unicode, Zawgyi, Pāḷi with stacks (must not be converted as Zawgyi), a leading ေ, mixed Latin and Burmese, and `unsure` cases; `evidence` per case.
- **Canonicalizing:** the golden vectors from section 7, and idempotence.
- **Dead keys:** every sequence in section 5, checked against `unicodeToWinInnwa` of the matching Unicode (so the key table and the converter cannot drift), plus cancel and off.
- **Switching method:** Unicode ↔ Win Innwa round trips, with the lossy notes.
- **Browser:** the dead key, paste of Latin-1 glyphs and composition in the DOM adapter, in a Playwright test; every control at 375 px in English and Burmese.

## 10. Analytics and privacy

Per `AGENTS.md` ("New mini apps"), no typed text ever reaches the tracker. Events are built by pure functions in the app and tested for fixed values only. They are in [analytics.md](analytics.md) §3 (the "Burmese typing" row, added 2026-11-27) with their questions in §3.1 (43, 41, 42 and 44):

- `input_method_change`: `method` (`auto`, `unicode`, `win-innwa`), `via` (`settings`, `field`);
- `input_stack_key_change`: `on` (true or false);
- `input_keys_use`: `app` (the mini app's registry id), `kind` (`stack`, `letter`, `ligature`, `kinzi`);
- `input_auto_fix`: `app`, `fix` (a fixed code from the package's `Fix` and `Note` lists), once per lookup or submit when Auto changed something or could not tell.

The shared field sends these, so every app that uses it counts them the same way, and an app adds only its own events (for the Pāḷi Dictionary, [pali-dictionary.md](pali-dictionary.md) §9). The Privacy page gets a sentence in both languages: the typing choice is saved on this device only.  The Privacy page has the sentence in both languages (`privacyInputAnalytics`, Burmese flagged for review).

## 11. Open questions

1. **Dead-key table.** Confirm with a native Win Innwa typist, and against the original driver's Alt codes. Decide then about the 13 remaps.
2. **Å and ¦** (ta, tha after a short na): are they in `win-innwa.woff2`, and should `unicodeToWinInnwa` use them?
3. **A forced Zawgyi method.** Reserved. Add it only if the "unsure" prompt is not enough.
4. **Auto thresholds.** The short-text marker rule and the 0.9 score gate need a Burmese-speaker review with real typing, as library search's would.
5. **Burmese messages** for the setting rows and notices need a reader's review.
6. **Credit and licence.** Check pndaza's layout terms if more than key sequences is ever needed.
