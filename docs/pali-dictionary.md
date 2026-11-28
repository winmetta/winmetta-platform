# Pāḷi Dictionary (mini app)

**Status:** proposed 2026-11-27. Stage 2 of the plan (section 10) is built: contract, mock, client, key and the pure logic under `apps/web/src/lib/pali-dictionary/`; the page is not. This is the design for a Pāḷi → Burmese dictionary mini app that starts with a **mock lookup**, so the interface can be settled before the data and the service exist. The data comes from [`winmetta/pali-myanmar-dictionaries`](https://github.com/winmetta/pali-myanmar-dictionaries) (its [implementation plan](https://github.com/winmetta/pali-myanmar-dictionaries/blob/main/docs/implementation-plan.md) is at Stage 2 of 7). Typing is handled by the generic input package in [myanmar-input.md](myanmar-input.md). It follows the mini-app rules in [design-guide.md](design-guide.md) §9 and the foundation in [meditation-bell.md](meditation-bell.md) §2.

**Why:** learners and teachers meet Pāḷi words in Burmese script (ဓမ္မ, သတ္တ, ပါဠိ) and want the meaning in Burmese from the standard printed dictionaries, with the book, volume and page each meaning comes from. Today that means a PDF or an app with an English keyboard that cannot type stacked letters. A free lookup that accepts Unicode, Zawgyi or Win Innwa typing, and always says which dictionary an answer comes from, serves the monastic community and costs little to host.

---

## 1. Decisions (proposed 2026-11-27)

| Decision | Choice | Notes |
| --- | --- | --- |
| Scope for now | **Pāḷi terms in Burmese script → Burmese meanings** | No English, no Roman (IAST) typing, no Burmese → Pāḷi yet. The data has them (`u-hoke-sein-mep`, `headword_iast`); the page does not. |
| Name | **Pāḷi Dictionary** (Title Case); slug `pali-dictionary`; message key `miniAppPaliDictionaryName` | The Burmese name (for example ပါဠိ-မြန်မာ အဘိဓာန်) needs a reader's review. |
| Typing | **The shared field** from [myanmar-input.md](myanmar-input.md): Auto, As typed, Win Innwa, site-wide setting, optional Pāḷi keys tray | The page asks for Unicode and applies its own search key to it. |
| First version of the data | **A mock** behind one `lookup()` function | Same request and response as the real service, so only that function changes later. |
| Real backend | **Static files on the CDN first, an API as fallback** (proposed, not decided) | Section 6. |
| Provenance | **One card per dictionary, never merged** | Rule from the dataset's `AGENTS.md`: every definition keeps its `source_id`, volume and page. |
| Content | **Shown exactly as stored** | No summarising, rewording or "improving": dictionary text comes from the books, as teachings come from the teachers ([AGENTS.md](../AGENTS.md) §7, "Content"). |
| Language | **Fully translated** (`en`, `my`); Burmese flagged for review | Its readers are mostly Burmese readers. Confirm (section 11). |
| Where it runs | **Browser plus the lookup backend** | The typed text goes only to the lookup, never to the analytics tracker (section 9). |

Out of scope for now: the reverse direction, English glosses, Roman Pāḷi lookup, inflected forms (the Stage 6 lemmatizer), searching inside definitions (section 6), accounts, saved words, history, "word of the day" and anything that counts or rewards use ([design-guide.md](design-guide.md) §7).

---

## 2. Screens

Mobile first, designed at 375 px, then wider ([design-guide.md](design-guide.md) §9). A wireframe was reviewed in conversation on 2026-11-27; the page is built from the shared `mini-*` classes, not a new look.

**Title bar:** back link ("Mini Apps"), icon, name, language menu, like the other mini apps. The title bar is the page heading. A "Pāḷi → Burmese" line under it says what the tool does.

**Typing view (the first screen):**

- the shared field with its method choice, the caption ("Shown in Win Innwa · keys `"r®`") and the "Using ဓမ္မ (Unicode)" line; the Pāḷi keys tray is on;
- the main button **Look up** (`.mini-button--primary`, one per panel) and a small **Clear** (`.mini-button--small .mini-button--danger`, disabled when empty);
- with an empty box, three **example words** as small buttons that fill the box in the current method's encoding (so a Win Innwa typist sees Win Innwa glyph codes);
- notices (Auto fixes, "unsure", a query that is too long) in one `role="status"` area under the method choice.

**Results view** (same page, below the field on a phone, beside it from 900 px with `wide`):

- a notice at the top while the data is a mock: "Sample entries. The real dictionary is not connected yet.";
- the **matched word** (large) and a read-only match label with a symbol: "Exact match", or "Matches ignoring spelling differences" (ါ/ာ, stacked or not, ဥ/ဉ, ှ/ဟ);
- a count ("3 dictionaries") and an optional filter by dictionary (a native `<select>` once there are more than three; section 11);
- **one card per dictionary**, ordered by the dataset's `priority_rank`: the book title, the volume and page when known ("Volume 10 · page 124"), a "Read by OCR" badge when `quality` is `ocr`, then the part of speech, the etymology line and the definition text exactly as stored;
- a muted **"Also matches"** row of near words (prefix matches and spelling variants), each a small button that fills the box and looks it up;
- a **Share** standard button that copies the address with `?q=` (the query is Unicode, so it works whatever method typed it; the site's analytics reports page views without the query string).

**About these sources** (a disclosure under the results): the list of dictionaries in the answer with author and year, and the licence line each needs. Rows that come from the CC BY-SA 4.0 OCR fill (`license_id`) must show the required attribution (the dictionary's `AGENTS.md`).

**Wide screens** add columns, never new features: the field on the start side, results on the end side, sharing grid rows so labels and buttons line up.

### 2.1 States (every control that waits has all of them)

| State | What the reader sees |
| --- | --- |
| Empty | The examples, a one-line help, nothing else. |
| Typing | The live "Using … (Unicode)" line updates on every change; no request is sent. |
| Loading | The button shows busy; results already on screen stay until the new ones arrive. |
| Found | The results view above. |
| No result | "No entry for ဓမ္မာ…" with what to try: check the spelling, switch method, or the "Did you mean …?" offer when the other reading finds something. |
| Error | A message with **Try again**; earlier results are kept ([design-guide.md](design-guide.md) §5). |
| Too long | A query over about 64 characters is refused with a message; a word, not a text, is expected. |

Searching runs on the button or Enter. There is no search as you type, so a real backend is not asked on every key.

---

## 3. Input

Settled in [myanmar-input.md](myanmar-input.md). What this app decides:

- it offers all three methods and shows the Pāḷi keys tray (a feedback box would not);
- it sends **only** the `unicode` value to `lookup()`;
- when Auto is `unsure` it shows the notice and a **Search as Zawgyi** small button, which resolves that one query as Zawgyi;
- when a lookup finds nothing, it tries the other reading of the same input once and, if that finds entries, offers "Did you mean …?" instead of showing nothing;
- if the box holds Latin letters in Auto or As typed, it suggests Win Innwa mode.

---

## 4. The lookup contract

The page calls one function. The mock and the real service return the same shape.

```ts
interface LookupRequest {
  q: string;            // canonical Myanmar Unicode, from the input package
  sources?: string[];   // restrict to some source_id values
  limit?: number;
  cursor?: string;
}

interface LookupResponse {
  v: 1;
  q: string;
  keyVersion: number;                 // HEADWORD_KEY_VERSION of the data answering
  via: 'cdn' | 'api' | 'mock';
  matchKind: 'exact' | 'loose' | 'prefix' | 'none';
  groups: {
    headword: string;
    headwordIast?: string;
    entries: Entry[];
  }[];
  related: string[];                  // near words for "Also matches"
  sources: SourceMeta[];              // for attribution and the filter
  mock: boolean;
}

interface Entry {
  sourceId: string;
  pos?: string;
  etymology?: string;
  definitionText: string;
  volumeCode?: string;
  printedPage?: number;
  quality: 'proofed' | 'ocr';
  licenseId: string;
}
```

- **Field names follow the dataset's `entries` and `sources` tables** (dictionary plan §3), so real rows can be returned unchanged. The schema's `senses`, `citations` and `extra` are not shown yet.
- **The key stays on the lookup side.** The client sends Unicode; whoever answers applies the headword key (`@winmetta/pali-text`). This keeps the key rules out of the page and lets one key version serve all clients. The page still checks `keyVersion` against the version it was built for and shows a clear error on a mismatch instead of "no result".
- **Matching tiers**, in order: exact headword, then loose key match (`headword_norm`), then prefix suggestions for two or more syllables. Inflected forms wait for the lemmatizer (Stage 6).
- **Ordering:** groups by relevance, entries inside a group by the dataset's `priority_rank`; entries from different dictionaries are never combined.
- **Parsing:** like book search, the client checks only what it uses and treats an unexpected answer as an error (`lib/book-search.ts` `parseResponse` is the model).

### 4.1 The mock

- Lives in `apps/web/src/lib/pali-dictionary/` (`contract.ts`, `fixtures.ts`, `mock.ts`, `client.ts`, `events.ts`), with `client.ts` exporting the one `lookup()` the page imports.
- About 12 sample headwords covering one source, several sources, a loose match, a prefix match, no match, an OCR row, an error and a slow answer, plus a delay of 300–600 ms. A dev-only switch (for example `?mock=error`) forces a scenario for browser tests; it is absent from the production build.
- The key: until `@winmetta/pali-text` has a pinned release, the mock calls an interim key function in the shared `interim.ts` pattern ([myanmar-input.md](myanmar-input.md) §7), checked against golden vectors generated from the Python `to_headword_norm`. One import changes later.
- **Definition text.** Doctrinal and dictionary content must come from the sources, not from us. Until real, reviewed entries exist, fixture definitions are visibly placeholder text under the "Sample entries" notice. Once the dictionary's Stage 2 output is reviewed, the fixtures become real excerpts from the sources the dictionary treats as publishable, with their attribution.

---

## 5. Data and licences

The page ships only datasets the dictionary repository marks publishable. Its manifest currently marks the `pm3` enrichment as "unverified; do not publish without resolving upstream rights", and OCR rows carry CC BY-SA 4.0 attribution duties. Real data does not go live until those are cleared in that repository, and the "About these sources" line shows each row's licence. The `pndaza` digitizations are treated as public domain by a documented Win Metta decision (2026-11-26) and credited as the dataset says.

---

## 6. Where lookup runs (proposed, not decided)

The whole dictionary (about 350,000 entries) is far too large to load in a browser, especially on a phone. Two realistic options, behind the same `lookup()`:

| | CDN files | API |
| --- | --- | --- |
| How | The page computes the key, fetches the file for its prefix and finds the entries | A small service (a Lambda over SQLite, like [book search](book-search.md)) |
| Server | None | A little to run and watch |
| Cost | Lowest | Low, not zero |
| Matching | Exact, loose, prefix; not inside definitions | Everything, including full-text and, later, inflected forms |

**Proposal:** start with the CDN for headword lookup and add the API later as a fallback for what files cannot do. A router behind `lookup()` tries the CDN first and asks the API, if switched on, when the CDN returns nothing or fails. Both return the same `LookupResponse`, with `via` saying which answered. "Search inside definitions" would be a separate action after the first lookup, hidden behind a flag until the API exists, so the common case stays fast and API cost stays predictable. Constraints:

- shards are keyed by the **loose key**, so ဓမ္မ, ဓမမ and ဓမ္မာ share a file; the scheme is chosen and the key frozen before shards are built (dictionary plan §4.1, key version);
- **shard sizes are not measured.** Common starting syllables (ဓမ္မ, သ, ပ) may give uneven files; measure on the compiled master database first;
- the browser client must refuse a dataset whose `keyVersion` differs from the one it was built for.

Downloading the whole SQLite file into the browser was considered and rejected (hundreds of megabytes).

---

## 7. Files

New: `apps/web/src/components/PaliDictionaryIsland.tsx`; `apps/web/src/lib/pali-dictionary/*` (section 4.1, plus `state.ts` for the pure view logic); `apps/web/src/pages/[locale]/mini-apps/pali-dictionary/index.astro`; the icon in `src/assets/mini-apps/` (designed in Canva, [meditation-bell.md](meditation-bell.md) §2.1); `en` and `my` messages. Changed: `lib/mini-apps.ts` (a `coming` entry until the page exists, then `beta`), the settings page (rows from [myanmar-input.md](myanmar-input.md) §6), the Privacy page, [analytics.md](analytics.md) and the unit and browser tests. The page is unlinked and `noindex` until `PUBLIC_MINI_APPS` is on, like the other mini apps.

---

## 8. Tests

- **Pure logic** (`state.ts`, `client.ts`): view states, the router (CDN, then API), retry keeping old results, the key-version check.
- **Contract:** the mock's answers parse with the same parser as the real service; fixtures have no HTML and no Zawgyi.
- **Key vectors:** the shared vectors from the Python function (`ဓမ္မ` / `ဓမမ` and the other cases in dictionary plan §4.1).
- **Events:** a unit test that every event carries only fixed values and buckets (like `text-converter-events.test.ts`).
- **Browser (Playwright):** each input method end to end (Unicode, Zawgyi, Win Innwa with the dead key), the example buttons, the states above, and that **no request to the tracker contains the typed text**. Screenshots at desktop and 375 px, English and Burmese; compare the title bar, a dropdown and a button with the Meditation Bell.

---

## 9. Analytics

Added to [analytics.md](analytics.md) §3 and §3.1 (questions 39–46) on 2026-11-27, ahead of any code. Every feature is counted without personal information ([AGENTS.md](../AGENTS.md), "New mini apps"). Properties are fixed words or buckets; never the typed text, the matched word, a definition, the sources an answer came from, an exact length, or the detector's verdict on a particular text. Events are built by pure functions in `lib/pali-dictionary/events.ts` and tested for fixed values only.

| Event | Properties | Question it answers |
| --- | --- | --- |
| `pali_lookup` | `method` (`auto`, `unicode`, `win-innwa`), `length` bucket (1–5, 6–15, 16+ characters), `match` (`exact`, `loose`, `prefix`, `none`), `results` bucket (0, 1, 2–3, 4+ dictionaries), `via` (`cdn`, `api`, `mock`) | Is the dictionary used, how often is nothing found, which typing methods are used |
| `pali_example` | none | Do the example words help new visitors |
| `pali_retry` | `kind` (`other-reading`, `search-as-zawgyi`) | Do the recovery offers rescue searches |
| `pali_related` | none | Are the "Also matches" words used |
| `pali_filter` | `scope` (`all`, `one`) | Is the by-dictionary filter used |
| `pali_share` | none | Do people share a word |
| `pali_issue` | `kind` (`error`, `too-long`, `key-mismatch`) | What goes wrong (a word with no entry is `pali_lookup` with `match=none`, not an issue) |

The shared field's own events, `input_method_change`, `input_stack_key_change`, `input_keys_use` and `input_auto_fix` (each with the app's registry id where it applies), are described in [myanmar-input.md](myanmar-input.md) §10, so every app with a Burmese field counts them the same way.

**Privacy.** The Privacy page gets a paragraph in both languages (Burmese flagged for review): the typed word is sent to the dictionary service to be looked up and is not stored, and the analytics count only the events above; the typing method is saved on this device only. The service must not log the query (no request logging of it, no CDN access logging). With the CDN option (section 6) a request carries only the key's shard, its first syllables, not the word; the paragraph changes accordingly. Add the events to the end-to-end check that no request to the tracker contains the typed text.

---

## 10. Staged plan

0. **Docs** (this file, [myanmar-input.md](myanmar-input.md), the dictionary plan's §4.1 requirements) and the analytics entries in [analytics.md](analytics.md). Wireframe reviewed 2026-11-27.
1. **`@winmetta/myanmar-input` core** and its tests ([myanmar-input.md](myanmar-input.md) §8, stage 1).
2. **Contract, mock and `client.ts`** with the interim key and vectors; pure state, event and reading builders with their tests. **Done.** `?mock=error|slow|key-mismatch` is honoured only in dev builds or when `PUBLIC_PALI_MOCK_SCENARIOS=true` (set it for the Playwright preview build, never in production). `@winmetta/myanmar-input` exports `canonicalize`, so `canonical.ts` stays the one seam to replace in stage 4.
3. **DOM adapter, shared field and Settings rows**, then **the page**, the registry entry, icon, messages and Privacy paragraph; browser tests.
4. **Swap the interim key and canonicalizer for `@winmetta/pali-text`** once it has a pinned release; delete the interim file.
5. **Real data, behind a flag:** CDN shards (or the API) from a compiled dataset whose licences are cleared (section 5); remove the "Sample entries" notice only then.
6. **Go live as Beta** with `PUBLIC_MINI_APPS`, after a Burmese reader has reviewed the interface text and a Pāḷi-literate reader has checked sample lookups.

## 11. Open questions

1. **CDN first with an API fallback?** Proposed in section 6; shard sizes unmeasured. Decide before the dictionary's Stage 6 release format is final.
2. **Is searching inside definitions a v1 feature?** If yes, the API is needed from the start.
3. **The by-dictionary filter in v1,** or later once more dictionaries are in the data?
4. **Query length limit** (about 64 characters) and whether to allow several words.
5. **Fully translated or English labels** like the bell? Proposed: fully translated.
6. **Burmese name, icon and messages** need a reader's review.
7. **When the key is frozen** and which `pali-text` release the page first depends on.
8. **Real fixture data:** which reviewed entries, once Stage 2 output exists.
