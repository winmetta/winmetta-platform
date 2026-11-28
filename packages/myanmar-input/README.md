# `@winmetta/myanmar-input`

Turns what a person typed in a Burmese field into clean Unicode, and says what it did. Private workspace package; design in [docs/myanmar-input.md](../../docs/myanmar-input.md). Stages 1 (core) and 2 (the DOM adapter, `./dom`) are built. The shared React field and the Settings rows are stage 3.

```ts
import { resolveInput, switchMethod, createKeyEngine, keyGroups, fontFor } from '@winmetta/myanmar-input';

const result = resolveInput(raw, { method: 'auto' });
result.unicode; // the only value an app should store or send
result.source; // 'unicode' | 'zawgyi' | 'win-innwa'
result.fixes; // codes such as 'moved-e', 'zawgyi-converted'
result.notes; // codes such as { code: 'unsure' }
```

- **Methods:** `auto` (detect Unicode or Zawgyi, convert, tidy), `unicode` (as typed, nothing changed), `win-innwa` (the box holds glyph codes drawn by the Win Innwa font).
- **Codes, not sentences:** the package returns `Fix` and `Note` codes. Messages, fonts, styling, storage of the choice and analytics belong to the page.
- **Nothing typed leaves the browser:** the package makes no requests and stores nothing.
- **Key engine:** `createKeyEngine('win-innwa').handle(event, textBeforeCaret)` returns `insert` (with how many characters before the caret to replace), `arm`, `cancel` or `pass`. It is pure; the DOM adapter will act on it.
- **Tray data:** `keyGroups(method)` lists the Pāḷi keys (stacked consonants, extra letters, ligatures, kinzi, punctuation) with the text to insert for that method.
- **DOM adapter** (`@winmetta/myanmar-input/dom`): `attachInput(field, { method, stackKey })` wires the key engine and paste handling to an `<input>` or `<textarea>` and returns `{ update, detach }`; `insertAtCaret(field, text, replace)` is what the keys tray calls. It acts only inside its own `keydown` or `paste`, never between `compositionstart` and `compositionend`, and tells the page with a normal `input` event. In Win Innwa, pasted Unicode Burmese becomes glyph codes and pasted Latin-1 glyph codes are kept. Dead keys need real key events, so they work on desktop keyboards; a virtual keyboard's `Unidentified` keys pass through.
- **Interim canonicalizer:** `src/interim.ts` is a port of the Python syllable orderer, checked against `src/interim.vectors.json`. It is deleted when `@winmetta/pali-text` ships a replacement (design doc section 7); `canonical.ts` is the only importer, and `canonicalize` is exported from there for apps (the Pāḷi Dictionary's key uses it).

## Constraints

- **Latin letters and Western digits cannot be typed in Win Innwa mode.** Its keys are glyph codes, so letters and digits type Burmese. Do not use the package for email, URL or number fields.
- **Shift+F is the dead key**: press it, then a consonant key to stack it. Kinzi is `f` `f` (a single `f` is asat). Pressing Shift+F twice drops the dead key and types `F`. A key outside the table cancels the dead key and types normally.
- **Roman Pāḷi (IAST)** is not typed or converted here; that is `@winmetta/pali-text`.
- **Zawgyi vs Unicode** in Auto: a Zawgyi-only pattern decides on short text; long text (40 or more Burmese characters) also trusts the detector score. Pāḷi stacks alone are never converted: they get the note `unsure`.

## Regenerating the golden vectors

`src/interim.vectors.json` holds `{ input, canonical }` pairs produced by `canonicalize_myanmar_syllables` in [`winmetta/pali-myanmar-dictionaries`](https://github.com/winmetta/pali-myanmar-dictionaries). Run that function over the words in the file from that repository (`PYTHONPATH=src`) and write the result back.

## Commands

```bash
npm test --workspace @winmetta/myanmar-input
npm run typecheck --workspace @winmetta/myanmar-input
npm run test:browser --workspace @winmetta/myanmar-input
```

`test:browser` bundles the adapter with Vite, loads it into a blank Chromium page with Playwright (dead key, ligatures, kinzi, selection, paste, composition) and needs `npx playwright install chromium` once.
