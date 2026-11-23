# Book search: searching inside library PDFs

**Status:** the pilot index serves five books. Full-library releases are built locally and published as versioned indexes. The AWS design and rollout checks are in §12. The implementation checklist is in [implementation-plan.md](implementation-plan.md) §5C.

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

**Later work:** §12 covers the AWS backend, full backfill and index publication. §13 covers the Dhamma Library page. State-store backup and Google Cloud Vision remain future options.

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
npm run book-search:backfill -- --workers 4   # fetch and index every catalog PDF, resuming saved pages
npm run book-search:backfill -- --pilot       # fetch and index the pilot list
npm run book-search:backfill -- <bookId>...    # fetch and index selected books
npm run book-search:build -- --all            # require page records for every book in the manifest
npm run book-search:build [-- <bookId>...] [--version <name>] [--allow-incomplete]
```

`--force` redoes the pages in the `--pages` range (every page without it) and keeps the other pages' records, unless the PDF or the extractor version changed, which makes all records stale. `--ocr never` records only text-layer pages; pages that need OCR are left unrecorded (counted as "need OCR") so a later `auto` run does them, and `--force` is refused with it. `npm run dev` (and `just dev`) serves the newest built index to the page through a local proxy for `/api/search`, so Search inside PDFs works in the dev server; `--no-book-search` turns it off. `--pilot` names the books in `apps/book-search/pilot/books.json` (added with the pilot, §10). `index` with no ids indexes every PDF already in `pdfs/`. It exits 2 if any page failed with an error; those pages are not recorded and are retried on the next run.

The backfill processes books in order of file size with four workers by default. It continues after a book fails, writes results to `backfill-progress.jsonl`, and exits with status 2 when a book needs attention. Rerun it to resume once the problem is resolved. On an interrupted run, check the PID in `backfill.lock` and remove a stale lock before restarting. The work folder needs room for the PDFs, records, and SQLite build files. The catalog generator collapses duplicate copies. Compare the current catalog against the source inventory before building a full release.

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

**How the build runs** (`apps/book-search/src/builder.ts`). Books are the ids named, else every book that has page records. The builder validates and inserts one book at a time, keeping the SQLite work file unpublished. It refuses to publish, listing every problem, when a book has no records, a page beyond the PDF's page count (read with `pdfinfo` from the fetched PDF), a page recorded twice, records from more than one PDF file or from another extractor version, or pages with no record. `--allow-incomplete` skips only the last check and lists the missing pages in the report. It then creates `dist/library-search-<version>.sqlite.building`, inserts everything in one transaction, runs FTS5 `optimize`, `VACUUM` and `PRAGMA integrity_check`, checks the row counts of `books`, `pages`, `passages` and `passages_fts` against what it inserted, and hashes the file in bounded chunks. It only then renames the file to `dist/library-search-<YYYY-MM-DD>-r<n>.sqlite` (the date is UTC; `<n>` is the next free number). It never overwrites an existing release, and a failed build leaves no file. Next to the database it writes `<name>.sqlite.sha256` and `<name>.report.json`, the indexing report: per book the page count, recorded pages, passages, counts by method and status, and the missing pages as ranges, plus totals and the file size. `meta` also records the manifest revision (the first 12 hex characters of the SHA-256 of `manifest.json`), the extractor version and the engines that read the pages.

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
| `q` | Required, 1–200 characters after normalization, at most 8 terms. A Burmese term needs at least two syllables or three characters (so `ဓမ္မ` works and a single letter does not). `"…"` is a phrase. |
| `lang` | `any` (default), `my`, `en`, `pi` or `und`; filters on the passage language |
| `limit` | 1–20, default 10 |
| `page` | 1–10, default 1 |

Unknown parameters are rejected. The query parser accepts only terms and quoted phrases and quotes every token itself, so FTS5 syntax typed by a user (`OR`, `NEAR`, `*`, `^`, `"`) is searched as text, never run as an operator. Values are bound parameters. Results are ranked with `bm25()`, one result per PDF page (its best passage), so a page is cited once.

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
- **Errors** are `{ "v": 1, "error": { "code": "…" } }` with status 400 (`query_missing`, `query_too_short`, `query_too_long`, `too_many_terms`, `bad_param`), 404 for another path, 405 for a method other than GET, 403 `forbidden_origin` for a request the browser marks cross-site, 500 `internal_error` for an unexpected failure (no detail), and 503 `index_unavailable`.

**`GET /api/search/health`** returns `{ "v": 1, "indexVersion", "books", "pages", "passages" }`.

**Local server** (`npm run book-search:serve -- --db <file>`): `node:http`, listening on `127.0.0.1:8787` only, opens the file read-only. Like the planned production route, it sends no CORS headers and refuses a request whose `Sec-Fetch-Site` header is `cross-site`. It logs one line per request with status and duration, never the query.

## 8. API client and CLI

- **Client** (`apps/book-search/src/client.ts`): `createSearchClient({ baseUrl, fetch?, timeoutMs? })` with `search(params)` and `health()`. It appends `/api/search` to `baseUrl`, validates responses with Zod and throws a `SearchApiError` carrying the HTTP status and error code. Nothing in it is specific to the local server or to AWS.
- **CLI:**

  ```bash
  npm run book-search:serve                      # local server on 127.0.0.1:8787, newest built index
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

`apps/book-search/pilot/books.json` lists the pilot books with the reason each was chosen. The plan is 30 manifest book ids covering Burmese, English and Pāḷi books and born-digital, scanned, mixed-language and poor-quality copies, with at least one known Zawgyi or legacy-font text layer. **What exists today is five books** (three Burmese, two English: legacy-font and scanned Burmese, born-digital English, with Pāḷi terms in the English ones); the 30-book list and its reader-supplied queries are still to do. The PDFs are fetched from the public CDN, so no AWS access is needed.

The stage 1 report records:

- pages per method and status (`text`, `ocr`; `ok`, `suspect`, `failed`) and the reasons for failures;
- OCR time per page on the machine used, and the projected time for the whole library (3,009 books, about 113.5 GiB, page count measured during the pilot);
- index size per 1,000 pages and the projected size for the whole library (`dbBytes` and the page counts in the build report);
- local query latency at p50 and p95;
- golden-query results: target at least 90% with the expected book and page in the first five results, reported separately for Burmese and English and for `text` and `ocr` pages;
- a spot check of every pilot result's page link against the PDF.

**Early observations (2026-11-20, step 3, two small Burmese books, pages 1–6 each):** OCR with `mya+eng` at 300 dpi took about 6 seconds per page on one core of the developer's MacBook, so about 70 seconds for 12 pages. At that rate 100,000 pages would take about a week, and the whole library's page count is not measured yet, so the pilot must quantify what the full backfill needs (parallel runs, a bigger machine or a different engine). In one book the text layer was Zawgyi on pages 2–6 (OCR read them at 0.76–0.91 confidence), and page 1 was ASCII-mapped legacy-font text that the first version of the quality check accepted; it now goes to OCR. In the other book the pages were scans with no text layer; pages 2–5 were read at 0.70–0.82, and two pages of artwork produced no text.

**Early observations (2026-11-20, step 4):** a build from the same two books (108 pages, 627 passages) gave a 0.58 MB file, about 5.4 MB per 1,000 pages of OCR'd Burmese, so a library of 750,000 pages (a guess, not measured) would be about 4 GB, which is too large to download on each Lambda cold start (a question for the AWS backend stage, §12). Searching it with `ftsTokens` phrases and `bm25()` found the expected pages: `နိဒါန်း` ranked page 5 (the introduction) first. 130 of the 627 passages were Latin text in Burmese books and so have language `und`.

**Pilot result (2026-11-21, five books, 285 pages):** the five books of `apps/book-search/pilot/books.json` (three Burmese, two English) were indexed and built into a 1.7 MB file (4,186 passages), and the 15 golden queries of `apps/book-search/pilot/golden-queries.json` were run with `npm run book-search:golden`: **14 of 15 (93%) found the expected page in the first five results** (Burmese 6 of 6, English 8 of 9), against the 90% target. This is not the plan's pilot: it is 5 books, not 30, and the queries were written by the indexer's author from the indexed text, not by readers, so it checks retrieval and ranking, not OCR accuracy. The one miss is `contemplation of mind-objects`: the page text has the line break `contem- plation`, and a hyphenated line break splits the word in the index (§11).

- **Methods and status:** all 55 + 82 + 23 pages of the three Burmese books were read by OCR, because the text layers of two of them are legacy-font text and the third is scanned; of the 160 Burmese pages 1 is `failed` (no text) and 28 are `suspect` (confidence under 0.6). The English books used the PDF text layer for 123 of 125 pages; the other two (image-only) were read by OCR and recorded as `failed` (no text).
- **OCR time:** about 6 seconds per page on one core (162 OCR pages took roughly 15 to 20 minutes); the PDF text layer takes well under a second a page. Page counts for the whole library are not measured, so the full backfill is not sized.
- **Index size:** about 6 MB per 1,000 pages for OCR'd Burmese (§5 gives the earlier figure).
- **Latency:** the query itself takes about 0.1 ms at the median and 0.2 ms at p95 in the local file (450 runs over the golden queries). Through CloudFront and the Lambda, a first request took 0.3 to 0.5 seconds and a repeated one (a cache hit) about 0.08 seconds.
- **OCR quality of Burmese:** Tesseract's `mya` model reads clean print well but produces much noise on old print, ornaments and handwriting-like pages (for example runs of stray letters and digits); the noise mostly makes pages unfindable rather than wrongly findable. A page that is noisy is still `ok` if the engine was confident, so the confidence threshold alone does not flag it.
- **Legacy-font text layers** were common: two of the three Burmese books had a text layer of ASCII-looking text on every page (found by the first run, which accepted it; the detection now uses the share of common English words, see §4), so the page numbers above are after that fix.

## 11. Known limitations in stage 1

- **Book ids** are the hash of the S3 key, so renaming or moving a file in S3 gives it a new id. Records keep `key` and `sha256` for remapping; stable ids are a decision for a later stage.
- **Tesseract's Burmese model** is weak on old print, stacked consonants and handwritten manuscripts. Some pages will be `suspect` or `failed`; those books stay findable through the catalog search.
- **No Pāḷi detection** inside Burmese-script books (§4), and no fuzzy matching: unlike catalog search, FTS5 matches whole tokens and phrases only.
- **`#page=N`** opens the right page in desktop Chrome, Firefox and Safari, but most mobile browsers ignore it.
- **Hyphenated line breaks** in a text layer (`contem- plation`) split a word into two tokens, so the whole word is not found. A repair is a later improvement: joining them would also glue real compounds, so it needs a rule.
- **Full corpus costs and timing** depend on the real page count, the percentage of scanned pages, and OCR quality. The five-book pilot puts a 750,000-page estimate at roughly 4 GB. At six seconds per OCR page, processing the scans takes months on one core.
- **The golden queries are the indexer author's**, not readers' (§10).

## 12. Later stages

Stage 1 is the local indexer, API and tests above. Two later stages were chosen by the maintainer on 2026-11-21 and are described in this section: the AWS backend and the Dhamma Library page (§13). The others stay notes, not designs.

### AWS backend (chosen 2026-11-21)

The same handler (`apps/book-search/src/api/handler.ts`) runs in a Lambda, reached only through `https://app.winmetta.org/api/search` and `/api/search/health` (same origin, no CORS, no public API, no WAF). Defined in `infra/pulumi/book-search.ts` behind the stack flag `bookSearchEnabled`; the Lambda is `infra/book-search/`.

- **Index storage:** a new private, versioned, encrypted bucket holds `releases/library-search-<version>.sqlite` and its `.sha256`. `npm run book-search:publish` verifies the local SHA-256 and uploads a built index and its sidecar with conditional writes. Large indexes use multipart uploads with checksums on the parts. A retry can reuse an object with the expected checksum metadata (dry run unless `--yes`). The stack setting `bookSearchIndexVersion` names the release to serve; setting the previous name is the rollback.
- **Pilot storage:** the function downloads the SQLite file and checksum into `/tmp` and verifies the digest on cold start. The pilot uses this mode by default.
- **Full corpus storage:** `bookSearchUseMountedIndex` mounts the same versioned releases from [S3 Files](https://docs.aws.amazon.com/lambda/latest/dg/configuration-filesystem-s3files.html) in two private subnets. The function opens the database as immutable and read-only. It checks for the checksum sidecar and matching SQLite release version at startup. The publisher verifies the complete checksum locally and S3 verifies the upload. Health reads counts recorded and verified by the builder. S3 Files lets SQLite read the needed pages without copying and hashing the entire database at every cold start.
- **Rollout checks:** test the mounted pilot first, then verify the full release against every book in the manifest. Measure cold and warm searches in both languages, including common terms and numbered pages. Compare the health response with the local build report and verify PDF page links before deploying the web app. Roll back by selecting the previous release. A failed open returns 503 and is retried on the next request.
- **Limits and protection:** reserved concurrency (default 5), five-minute CloudFront caching by query string, validation before any database work (unknown parameters, length, terms), two CloudWatch alarms (daily invocations, hourly errors), and a CloudFront Function that refuses cross-site and non-GET requests before the cache. The kill switch is the build flag that hides the search on the page (§13) and, at the edge, `bookSearchConcurrency` set to 0.
- **Privacy:** no query is logged anywhere: the Lambda logs only whether the index loaded, CloudFront access logging is off, and the analytics events carry no search text. The Privacy page says searches are processed on the server and not stored (§13).

What this does not stop: a script that sends requests to `app.winmetta.org/api/search` without a browser can fake any header. The concurrency cap and the alarms bound the cost; the effect of abuse is slower search. A public API (its own host, per-IP rules, optional keys) is a later decision if a real need appears.

### Azure backfill pilot (proposed)

Use a temporary Linux VM to run the existing Poppler and Tesseract pipeline against the public CDN. The job produces the same resumable per-book JSONL files and versioned SQLite release used by the AWS search API. Microsoft lists Burmese for language detection, but omits it from the supported printed-text extraction languages in Document Intelligence Read. The existing pipeline already handles scanned Burmese, legacy text layers and links to physical PDF pages. [Microsoft's OCR language support](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr?view=doc-intel-4.0.0)

1. Run `book-search:setup` on the VM with the tools in [the developer guide](developer-guide.md#book-search-tools-optional). Use a fresh `BOOK_SEARCH_WORK_DIR` and a fixed repository revision so the pilot measures extraction and records exactly which manifest was used.
2. Run `npm run book-search:backfill -- --pilot --workers 5`, then `npm run book-search:build -- --pilot`. Record elapsed time, the tool versions, and the build report's page counts and statuses. Serve the pilot database locally on the VM and run `npm run book-search:golden`. Compare with the baseline in §10 and spot-check the linked pages.
3. Save the pilot's page records, index, checksum and report before deallocating the VM. Measure a larger sample across languages and file sizes before sizing the full run. Check CDN throughput, disk space for the PDFs and build, and OCR throughput at the intended worker count. For a full release, use `book-search:build -- --all` so every manifest book must pass the build checks.

A North American full pass reads about 114 GiB from the CDN. At bunny.net's Standard rate of $0.01/GB it is roughly $1.20 for one download of the library, plus any AWS origin transfer for cache misses and the cost of retries. Price Azure compute, managed disks and artifact transfer separately using the benchmark. [bunny.net CDN pricing](https://bunny.net/pricing/cdn/) · [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)

### Notes, not defined

Each of these becomes a defined stage only when the maintainer chooses it. Nothing here is designed or scheduled.

- **Google Cloud Vision OCR:** run Cloud Vision as a second OCR engine and store its results in the same local state store and index (`engine` already records which engine read a page). Needs a Google Cloud project, billing and credentials, which need approval.
- **Compare Tesseract and Cloud Vision** on a few pages: character error rate against hand-checked text, failed pages, time and cost per page, then decide the engine for the backfill.
- **Sync the state store** to a private bucket so the indexing work survives the loss of the laptop.
- **Also noted:** stable book ids, the upload command and regeneration PR ([implementation-plan.md](implementation-plan.md) §6.2), and a public API with its own host, WAF and optional keys if a real need appears.

## 13. Dhamma Library page (chosen 2026-11-21)

A **Search inside PDFs** mode on `/<locale>/dhamma-library/`, next to the catalog search, which stays the default and keeps working with no JavaScript and no service. Built behind the build flag `PUBLIC_BOOK_SEARCH` (off unless set), so the page can ship before the service is live and the flag is the kill switch.

- **Behaviour:** a separate section, "Search inside PDFs", between the catalog search and the folder tree (`BookSearchIsland.tsx`, `lib/book-search.ts`); the catalog search is unchanged. It asks the same-origin `/api/search` only after the reader submits a query (never while typing), ten results at a time with "Show more pages", and shows each result as the book title, the physical PDF page, a snippet and whether the text came from OCR, with **Open PDF** (the `#page=N` link, in a new tab) and **Copy citation**. The query lives in the address as `?pdf=…` (other parameters are kept), so a search can be shared and runs on load; switching language keeps it like every other parameter.
- **Citation:** the copied text is the title, the page and the page link, written as `<title>, PDF page N, <link>`. The page is labelled the physical PDF page, because the printed page number can differ.
- **When the service is down or slow:** a short message saying inside-PDF search is unavailable, with the catalog search still working. Only the books indexed so far are searched, and the page says so ("N books are indexed so far"), with a link to the catalog for everything else.
- **Privacy:** the query goes only to `/api/search`; it is never sent to analytics (the events `book_search` and `book_search_result_click` record that a search happened, the result count as a range and the script, not the words; docs/analytics.md), and the Privacy page (a section that appears only when the flag is on, plus a changed catalog sentence) (English and Burmese) says searches are processed on the server and not stored. The Burmese wording needs review by a Burmese speaker before the Beta label is removed (implementation-plan.md §6.1).
