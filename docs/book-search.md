# Book search: searching inside library PDFs

**Status:** stage 1 planned 2026-11-20, not started. Stage 1 runs entirely on a developer's machine: nothing is deployed and no AWS resource is created. The checklist is in [implementation-plan.md](implementation-plan.md) §5C. Later stages are only notes (§12); the maintainer decides each next step when the previous one is done.

**Why:** the Dhamma Library catalog search finds a book by its title, tags and folder ([tech-architecture.md](tech-architecture.md) §3). Readers also need to find a passage _inside_ a book and cite the exact page in notes, articles or Dhamma Posts. Most books are Burmese, many are scans without a text layer, and some text layers are Zawgyi or legacy fonts, so the text has to come from OCR as well as from the PDF itself.

**Model:** book → PDF page → passage. Every result is a passage on a physical PDF page, linked as `<pdf>#page=N`. The linked PDF page is the citation source; OCR text only helps readers find it.

---

## 1. Stage 1 scope

**In:**

1. Index a set of library PDFs locally: text from the PDF's own text layer where it is usable, Tesseract OCR where it is not.
2. Keep the page results in a local state store (JSONL), and build one SQLite FTS5 file from it.
3. Serve the search API from a **local web server** that behaves like the future AWS backend (same path, parameters and responses).
4. An **API client** that takes a base URL, so the same client can later point at the AWS backend, and a **CLI** built on it.
5. Tests for the tokenizer, the query parser, the builder, the server, the client and the CLI.
6. A pilot on 30 PDFs, with the numbers recorded (§10).

**Out:** anything on AWS (S3 sync of the state store, the index bucket, Lambda, CloudFront), any change to the website, Google Cloud Vision, the upload command and the full backfill. They are listed in §12, not designed.

## 2. How it works

```text
PDF (public CDN) ──fetch──▶ work folder/pdfs/
        │
        ▼  extract (per page)
  pdftotext text layer ──quality check──▶ usable? ── yes ──▶ page record (method "text")
        │                                     no
        ▼
  pdftoppm 300 dpi image ──▶ tesseract mya+eng ──▶ page record (method "ocr")
        │
        ▼  append
  state/<bookId>.jsonl  (durable source; never rebuilt by OCR again)
        │
        ▼  build (one transaction)
  dist/library-search-<version>.sqlite  + .sha256
        │
        ▼  open read-only
  local API server  ◀── API client ◀── CLI and tests
```

## 3. Work folder

Everything the indexer reads and writes lives in **`winmetta-platform/.cache/book-search/`**, which is in `.gitignore`. Set `BOOK_SEARCH_WORK_DIR` to use another folder. It is never committed and never placed at the workspace root.

```text
.cache/book-search/
  tessdata/          # pinned Tesseract models (developer-guide.md §2, "Book search tools")
  pdfs/<bookId>.pdf  # downloaded copies of the pilot books
  state/<bookId>.jsonl
  tmp/               # rendered page images, deleted after each book
  dist/              # built SQLite files and their .sha256
```

Commands (implemented in `apps/book-search`; a book is named by its manifest id):

```bash
npm run book-search:setup                      # check Tesseract and Poppler, download and verify the models
npm run book-search:fetch -- <bookId>...       # copy PDFs from the public CDN (size checked against the manifest)
npm run book-search:index -- <bookId>... [--pages 1-6] [--ocr auto|always|never] [--force]
npm run book-search:build [-- <bookId>...] [--version <name>] [--allow-incomplete]
```

`--force` redoes the pages in the `--pages` range (every page without it) and keeps the other pages' records, unless the PDF or the extractor version changed, which makes all records stale. `--ocr never` records only text-layer pages; pages that need OCR are left unrecorded (counted as "need OCR") so a later `auto` run does them, and `--force` is refused with it. `--pilot` names the books in `apps/book-search/pilot/books.json` (added with the pilot, §10). `index` with no ids indexes every PDF already in `pdfs/`. It exits 2 if any page failed with an error; those pages are not recorded and are retried on the next run.

## 4. Page records (state store)

The indexer appends one JSON line per page to `state/<bookId>.jsonl` as each page finishes, so an interrupted run resumes at the next page. A page is redone only with `--force` or when its book's `sha256` or the extractor version changes.

```json
{
  "v": 1,
  "bookId": "a1b2c3d4e5f6",
  "key": "<S3 key from the manifest>",
  "sha256": "<SHA-256 of the PDF file>",
  "page": 12,
  "method": "ocr",
  "engine": "tesseract 5.5.4, tessdata_best e12c65a, mya+eng",
  "status": "ok",
  "confidence": 0.87,
  "passages": [{ "ordinal": 1, "script": "my", "text": "<the passage as read>" }],
  "extractedAt": "2026-11-20T21:00:00Z"
}
```

- `method` is `text` (the PDF's own text layer) or `ocr`. `status` is `ok`, `suspect` (low confidence or failed checks; still indexed, flagged in the report) or `failed` (nothing indexed for the page).
- **Text-layer quality check** (`apps/book-search/src/quality.ts`). The layer is used only when the page passes all of these, otherwise it is rendered and read by OCR, and the failed checks are recorded in `reasons`:
  - `too_little_text`: fewer than 20 letters (blank, image-only or a lone page number);
  - `zawgyi`: at least 3 Zawgyi-only patterns on the page (a glyph-only code point U+1060–U+1097, ေ before its consonant, or a loose virama), counted with the generator's marker regexes. Page text is long, so repeated markers are strong evidence; the detector score used for titles is not needed here;
  - `legacy_font`: three or more private-use characters; or, in a Burmese book, a page with under 10% Myanmar letters that has many odd symbols (15% or more) or fewer than three common English words. The last rule catches old Burmese fonts that extract as ASCII-looking text (for example `ausmfpf GmG a'guf`, seen on a real library page). It also sends romanized Pāḷi pages in Burmese books to OCR, which costs time and loses nothing. In an English book, ASCII-mapped garbage cannot be told from English (§11).
- **Passages** are paragraphs: blank-line blocks from `pdftotext -layout`, or Tesseract's paragraph blocks from its TSV output, whose word confidences give the page's mean `confidence`. Blocks over 1,500 characters are cut at a sentence end (`။`) or space. An OCR page below 0.6 mean confidence is `suspect` (the threshold is to be tuned in the pilot); an OCR page with no words is `failed` (`no_text`), which also happens for pure artwork or blank pages. Tesseract is run with `-c tessedit_create_tsv=1`, not the `tsv` config name, because the pinned `tessdata_best` folder has no `configs/` directory.
- **Script, not language.** Each passage records its script (`my`, `latn` or `mixed`). Its language is set when the SQLite file is built (§5, "Passage language"). Pāḷi written in Burmese script cannot be told apart from Burmese automatically, so stage 1 does not tag passages as Pāḷi.
- The book id is the manifest id (the first 12 hex characters of SHA-256 of the S3 key). It changes if the S3 key changes, so every record also keeps `key` and `sha256` and can be remapped (§11).

## 5. SQLite file

`npm run book-search:build` creates a new file from the approved manifest revision and the state store in one transaction:

| Table | Columns |
| --- | --- |
| `meta` | `key`, `value`: index version, manifest revision, extractor and model versions, build time |
| `books` | `id` (primary key), `key`, `title`, `author` (empty until the manifest has the field), `language`, `pages`, `sha256` |
| `pages` | `book_id`, `page`, `method`, `status`, `confidence`; primary key (`book_id`, `page`) |
| `passages` | `id` (integer primary key), `book_id`, `page`, `ordinal`, `language`, `script`, `display_text` |
| `passages_fts` | FTS5, contentless (`content=''`), columns `my_tokens` and `latin_tokens`, row id = `passages.id`. Language filters join `passages`; snippets come from `passages.display_text` |

A passage is stored twice: exactly as read in `passages.display_text` (snippets and citations), and as space-separated search tokens in `passages_fts`. For example, `ဓမ္မ ဒေသနာ` is indexed in `my_tokens` as `ဓမ္မ ဒေ သ နာ`.

**Passage language.** `passages.language` follows the script: Burmese script is `my`; Latin text is `en` in an English book and `und` in any other book (it may be English or romanized Pāḷi, which cannot be told apart reliably); mixed text takes the book's language. A `lang` filter in the API uses this column.

**How the build runs** (`apps/book-search/src/builder.ts`). Books are the ids named, else every book that has page records. Before anything is written the builder checks each book and refuses to build, listing every problem, when a book has no records, a page beyond the PDF's page count (read with `pdfinfo` from the fetched PDF), a page recorded twice, records from more than one PDF file or from another extractor version, or pages with no record. `--allow-incomplete` skips only the last check and lists the missing pages in the report. It then creates `dist/library-search-<version>.sqlite.building`, inserts everything in one transaction, runs FTS5 `optimize`, `VACUUM` and `PRAGMA integrity_check`, checks the row counts of `books`, `pages`, `passages` and `passages_fts` against what it inserted, and only then renames the file to `dist/library-search-<YYYY-MM-DD>-r<n>.sqlite` (the date is UTC; `<n>` is the next free number). It never overwrites an existing release, and a failed build leaves no file. Next to the database it writes `<name>.sqlite.sha256` and `<name>.report.json`, the indexing report: per book the page count, recorded pages, passages, counts by method and status, and the missing pages as ranges, plus totals and the file size. `meta` also records the manifest revision (the first 12 hex characters of the SHA-256 of `manifest.json`), the extractor version and the engines that read the pages.

The golden queries (§9) run after the search core exists (plan step 5) and are used for the pilot (step 6), so the builder does not run them.

The file is opened with Node's built-in `node:sqlite` (Node 24; its bundled SQLite 3.53.4 includes FTS5, checked 2026-11-20). No native npm module is needed.

## 6. Tokens and normalization

The website, the builder and the search API share one copy of the text code. Stage 1 moves `normalize.ts`, `burmese.ts` and `search-text.ts` from `apps/web/src/lib/` into a new workspace package, `packages/search-text`, and adds `ftsTokens(text)`:

- the same normalization as library search (NFC, zero-width removal, ဥ/ဉ equal, Burmese and ASCII digits equal, Latin diacritics folded, never on Burmese), so `dhamma` finds `dhammā` and `Pāḷi` finds `pali`;
- Burmese split into syllables with the existing syllable regex, one token per syllable, so a query of two or more syllables becomes an FTS5 phrase and matches regardless of the spaces the book used;
- Latin and digits as words.

The library and Dhamma Posts golden tests (`library-search.test.ts`, `posts/search.test.ts`) must pass unchanged after the move. FTS5's default `unicode61` tokenizer does **not** keep a Burmese syllable whole: it treats vowel signs, virama and asat (categories Mn and Mc) as separators, so `ဓမ္မ` is indexed as `ဓ`, `မ` (checked 2026-11-20 with Node's SQLite 3.53.4). The FTS5 tables therefore use `tokenize="unicode61 categories 'L* N* Co Mn Mc'"`, exported as `FTS_TOKENIZE` from `packages/search-text`, and a test there proves both facts. A stacked consonant stays inside its syllable (`ဓမ္မ ဒေ သ နာ` for `ဓမ္မ ဒေသနာ`), which is the syllable regex's rule.

## 7. Search API (v1)

The local server and the future AWS backend implement the same contract, so the client, the CLI and the tests do not change when the base URL does.

**`GET /api/search`**

| Parameter | Rule |
| --- | --- |
| `q` | Required, 1–200 characters after normalization, at most 8 terms. A Burmese term needs at least two syllables. `"…"` is a phrase. |
| `lang` | `any` (default), `my`, `en`, `pi` or `und`; filters on the passage language |
| `limit` | 1–20, default 10 |
| `page` | 1–10, default 1 |

Unknown parameters are rejected. The query parser accepts only terms and quoted phrases and quotes every token itself, so FTS5 syntax typed by a user (`OR`, `NEAR`, `*`, `^`, `"`) is searched as text, never run as an operator. Values are bound parameters. Results are ranked with `bm25()`.

```json
{
  "v": 1,
  "indexVersion": "2026-11-20-r1",
  "query": { "q": "ဓမ္မ ဒေသနာ", "lang": "any", "limit": 10, "page": 1 },
  "hasMore": false,
  "results": [
    {
      "bookId": "a1b2c3d4e5f6",
      "title": "<book title>",
      "language": "my",
      "page": 12,
      "snippet": "… ဓမ္မ ဒေသနာ …",
      "ocr": true,
      "confidence": 0.87,
      "pdfUrl": "https://dhamma-library.b-cdn.net/<key>#page=12"
    }
  ]
}
```

- `page` is the **physical PDF page** (1-based), which can differ from the printed page number. `pdfUrl` is built with the catalog's own `fileUrl(PUBLIC_LIBRARY_CDN_BASE, key)` (`apps/web/src/lib/library-index.ts`, which percent-encodes every key segment), then `#page=N` is appended, so a result links to the same file address as the catalog.
- The snippet is a window of `display_text` around the first match, at most 200 characters.
- **Errors** are `{ "v": 1, "error": { "code": "…" } }` with status 400 (`query_missing`, `query_too_short`, `query_too_long`, `too_many_terms`, `bad_param`), 404 for another path, 405 for a method other than GET, and 503 `index_unavailable`.

**`GET /api/search/health`** returns `{ "v": 1, "indexVersion", "books", "pages", "passages" }`.

**Local server** (`npm run book-search:serve -- --db <file>`): `node:http`, listening on `127.0.0.1:8787` only, opens the file read-only. Like the planned production route, it sends no CORS headers and refuses a request whose `Sec-Fetch-Site` header is `cross-site`. It logs one line per request with status and duration, never the query.

## 8. API client and CLI

- **Client** (`apps/book-search/src/client/`): `createSearchClient({ baseUrl, fetch?, timeoutMs? })` with `search(params)` and `health()`. It appends `/api/search` to `baseUrl`, validates responses with Zod and throws a `SearchApiError` carrying the HTTP status and error code. Nothing in it is specific to the local server or to AWS.
- **CLI:**

  ```bash
  npm run book-search -- search "ဓမ္မ ဒေသနာ" --lang my --limit 10
  npm run book-search -- search "dhamma" --base-url http://127.0.0.1:8787 --json
  npm run book-search -- health
  ```

  The base URL comes from `--base-url`, else `BOOK_SEARCH_BASE_URL`, else `http://127.0.0.1:8787`. The default output lists title, page, snippet and PDF link; `--json` prints the API response.

## 9. Tests

Vitest, like the rest of the repo. Fixtures are synthetic text only, never text copied from library books, so the tests run in CI without PDFs, Tesseract or AWS.

| Area | What is checked |
| --- | --- |
| `ftsTokens` | Burmese syllables with stacked consonants, spaced and unspaced Burmese, Pāḷi diacritics folded, digits, ဥ/ဉ |
| Query parser | terms and phrases, limits, FTS5 operators and stray quotes searched as text |
| Quality check | Zawgyi, glyph-only code points, ေ before its consonant, legacy-font Latin, empty pages |
| Builder | fixture JSONL → SQLite: tables, counts, `integrity_check`, the `unicode61` check in §6, golden queries |
| Server + client | the server starts on a free port with a fixture index; the client calls it through `baseUrl`: results, `lang` filter, paging, every error code, `Sec-Fetch-Site: cross-site` refused |
| CLI | spawned with `--base-url` against the same server: text and `--json` output, exit code on errors |
| Contract | the client suite reads its own variable, `BOOK_SEARCH_TEST_BASE_URL` (never the CLI's `BOOK_SEARCH_BASE_URL`, so a shell set up for the CLI cannot point `npm test` at a deployed backend); unset, it starts the fixture server, and later the same suite can run against a deployed backend on purpose |
| OCR smoke test | one tiny generated PDF with synthetic Burmese and English text, OCR'd with the pinned models; **skipped when `tesseract` is not installed** (CI does not install it in stage 1) |

**Golden queries for the pilot** live in `apps/book-search/pilot/golden-queries.json`: at least 30, supplied by Burmese and English readers, each with the expected book and page. They run against a locally built pilot index, not in CI, because the index is not committed.

## 10. Pilot

`apps/book-search/pilot/books.json` lists 30 manifest book ids with the reason each was chosen: Burmese, English and Pāḷi books; born-digital, scanned, mixed-language and poor-quality copies; at least one known Zawgyi or legacy-font text layer. The PDFs are fetched from the public CDN, so no AWS access is needed.

The stage 1 report, added to this file when the pilot is done, records:

- pages per method and status (`text`, `ocr`; `ok`, `suspect`, `failed`) and the reasons for failures;
- OCR time per page on the machine used, and the projected time for the whole library (3,009 books, about 113.5 GiB, page count measured during the pilot);
- index size per 1,000 pages and the projected size for the whole library (`dbBytes` and the page counts in the build report);
- local query latency at p50 and p95;
- golden-query results: target at least 90% with the expected book and page in the first five results, reported separately for Burmese and English and for `text` and `ocr` pages;
- a spot check of every pilot result's page link against the PDF.

**Early observations (2026-11-20, step 3, two small Burmese books, pages 1–6 each):** OCR with `mya+eng` at 300 dpi took about 6 seconds per page on one core of the developer's MacBook, so about 70 seconds for 12 pages. At that rate 100,000 pages would take about a week, and the whole library's page count is not measured yet, so the pilot must quantify what the full backfill needs (parallel runs, a bigger machine or a different engine). In one book the text layer was Zawgyi on pages 2–6 (OCR read them at 0.76–0.91 confidence), and page 1 was ASCII-mapped legacy-font text that the first version of the quality check accepted; it now goes to OCR. In the other book the pages were scans with no text layer; pages 2–5 were read at 0.70–0.82, and two pages of artwork produced no text.

**Early observations (2026-11-20, step 4):** a build from the same two books (108 pages, 627 passages) gave a 0.58 MB file, about 5.4 MB per 1,000 pages of OCR'd Burmese, so a library of 750,000 pages (a guess, not measured) would be about 4 GB, which is too large to download on each Lambda cold start (a question for the AWS backend stage, §12). Searching it with `ftsTokens` phrases and `bm25()` found the expected pages: `နိဒါန်း` ranked page 5 (the introduction) first. 130 of the 627 passages were Latin text in Burmese books and so have language `und`.

## 11. Known limitations in stage 1

- **Book ids** are the hash of the S3 key, so renaming or moving a file in S3 gives it a new id. Records keep `key` and `sha256` for remapping; stable ids are a decision for a later stage.
- **Tesseract's Burmese model** is weak on old print, stacked consonants and handwritten manuscripts. Some pages will be `suspect` or `failed`; those books stay findable through the catalog search.
- **No Pāḷi detection** inside Burmese-script books (§4), and no fuzzy matching: unlike catalog search, FTS5 matches whole tokens and phrases only.
- **`#page=N`** opens the right page in desktop Chrome, Firefox and Safari, but most mobile browsers ignore it.
- **Local only:** the index and API exist only on the developer's machine; readers cannot use them yet.

## 12. Later stages (notes, not defined)

Each of these becomes a defined stage only when the maintainer chooses it after stage 1. Nothing here is designed or scheduled.

- **Google Cloud Vision OCR:** run Cloud Vision as a second OCR engine and store its results in the same local state store and index (`engine` already records which engine read a page). Needs a Google Cloud project, billing and credentials, which need approval.
- **Compare Tesseract and Cloud Vision** on a few pages: character error rate against hand-checked text, failed pages, time and cost per page, then decide the engine for the backfill.
- **AWS backend for the API:** the same contract as a Lambda function reached only through `https://app.winmetta.org/api/search` (same origin, no public API, no WAF for now; reserved concurrency, CloudFront caching, query limits, a budget alarm and a kill switch), with the SQLite file in a new private index bucket and the state store synced to it. Pulumi, with approval before any apply.
- **Dhamma Library page:** a "Search inside PDFs" mode next to the catalog search, with **Open PDF** and **Copy citation**, and the Privacy page updated.
- **Also noted:** stable book ids, the upload command and regeneration PR ([implementation-plan.md](implementation-plan.md) §6.2), the full backfill of every PDF, and a public API with its own host, WAF and optional keys if a real need appears.
