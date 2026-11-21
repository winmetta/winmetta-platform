import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ftsTokens } from '@winmetta/search-text';
import { EXTRACTOR_VERSION, manifestPath } from './config.ts';
import type { Book } from './library.ts';
import { pdfPageCount, sha256File } from './pdf.ts';
import type { PageRecord } from './record.ts';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.ts';
import { loadState, statePath } from './state.ts';

/** Language of a passage: its script decides Burmese; Latin text takes the book's language only for English books. */
export function passageLanguage(
  script: 'my' | 'latn' | 'mixed',
  bookLanguage: string,
): string {
  if (script === 'my') return 'my';
  if (script === 'latn') return bookLanguage === 'en' ? 'en' : 'und';
  return bookLanguage;
}

export interface BuildOptions {
  books: Book[];
  stateDir: string;
  pdfsDir: string;
  distDir: string;
  /** Explicit version name; default is today's date and the next free revision number. */
  version?: string;
  /** Build even when a book has pages with no record (they are listed in the report). */
  allowIncomplete?: boolean;
  /** Page count of a book's PDF; default reads the fetched PDF with `pdfinfo`. */
  pageCount?: (book: Book) => Promise<number>;
  now?: () => Date;
  log: (line: string) => void;
}

export interface BookReport {
  id: string;
  title: string;
  key: string;
  language: string;
  pages: number;
  recorded: number;
  passages: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  /** Pages with no record, as ranges such as "5-9,12". */
  missingPages: string;
}

export interface BuildReport {
  version: string;
  builtAt: string;
  manifestRev: string;
  books: BookReport[];
  totals: { books: number; pages: number; recorded: number; passages: number };
  dbBytes: number;
}

export interface BuildResult {
  file: string;
  sha256: string;
  report: BuildReport;
}

const count = (map: Record<string, number>, key: string): void => {
  map[key] = (map[key] ?? 0) + 1;
};

/** "1,2,3,7" as "1-3,7". */
export function ranges(pages: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < pages.length;) {
    let j = i;
    while (pages[j + 1] === (pages[j] ?? 0) + 1) j++;
    parts.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}

/** The next unused `<date>-r<n>` name in the dist folder. */
export async function nextVersion(distDir: string, now: Date): Promise<string> {
  const day = now.toISOString().slice(0, 10);
  const taken = await readdir(distDir).catch(() => [] as string[]);
  let n = 1;
  while (taken.some((name) => name.startsWith(`library-search-${day}-r${n}.`)))
    n++;
  return `${day}-r${n}`;
}

/** What is missing or wrong with one book's records, as a list of problems (empty when fine). */
function checkRecords(pages: number, records: PageRecord[]): string[] {
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const record of records) {
    if (record.page > pages)
      problems.push(`page ${record.page} is beyond the PDF's ${pages} pages`);
    if (seen.has(record.page))
      problems.push(`page ${record.page} is recorded twice`);
    seen.add(record.page);
  }
  const shas = new Set(records.map((r) => r.sha256));
  if (shas.size > 1) problems.push('records come from more than one PDF file');
  if (records.some((r) => r.extractorVersion !== EXTRACTOR_VERSION))
    problems.push('records come from another extractor version');
  return problems;
}

interface LoadedBook {
  book: Book;
  pages: number;
  records: PageRecord[];
}

/**
 * Validates and yields one book at a time. A failure prevents publishing the build.
 */
async function* loadBooks(
  options: BuildOptions,
  pageCountOf: (book: Book) => Promise<number>,
): AsyncGenerator<LoadedBook> {
  const sorted = [...options.books].sort((a, b) => a.id.localeCompare(b.id));
  const failures: string[] = [];
  for (const book of sorted) {
    const loaded = await readBook(book, options, pageCountOf).catch(
      (error: unknown) => {
        failures.push(
          `${book.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      },
    );
    if (loaded) yield loaded;
  }
  if (failures.length > 0)
    throw new Error(
      `Not building, nothing was published:\n  ${failures.join('\n  ')}`,
    );
}

async function readBook(
  book: Book,
  options: BuildOptions,
  pageCountOf: (book: Book) => Promise<number>,
): Promise<LoadedBook> {
  const records = await loadState(statePath(options.stateDir, book.id));
  if (records.length === 0)
    throw new Error('no page records (run book-search:index)');
  const pages = await pageCountOf(book);
  const problems = checkRecords(pages, records);
  const recorded = new Set(records.map((r) => r.page));
  const missing = pages - [...recorded].filter((p) => p <= pages).length;
  if (missing > 0 && !options.allowIncomplete)
    problems.push(`${missing} of ${pages} pages have no record`);
  if (problems.length > 0) throw new Error(problems.join('; '));
  return { book, pages, records: records.sort((a, b) => a.page - b.page) };
}

/**
 * Builds one SQLite file from the manifest books and the page records of each, in one
 * transaction, optimizes and checks it, and only then gives it its final versioned name.
 * An existing file is never overwritten.
 */
export async function buildIndex(options: BuildOptions): Promise<BuildResult> {
  const { books, log } = options;
  if (books.length === 0)
    throw new Error('No books to build; name at least one book');
  const now = options.now?.() ?? new Date();
  const pageCountOf =
    options.pageCount ??
    ((book: Book) =>
      pdfPageCount(path.join(options.pdfsDir, `${book.id}.pdf`)));
  await mkdir(options.distDir, { recursive: true });
  const version = options.version ?? (await nextVersion(options.distDir, now));
  const finalFile = path.join(
    options.distDir,
    `library-search-${version}.sqlite`,
  );
  if (existsSync(finalFile))
    throw new Error(
      `${finalFile} already exists; releases are never overwritten`,
    );
  const workFile = `${finalFile}.building`;
  await rm(workFile, { force: true });

  const db = new DatabaseSync(workFile);
  const reports: BookReport[] = [];
  const engines = new Set<string>();
  try {
    db.exec(SCHEMA_SQL);
    const insertBook = db.prepare(
      'INSERT INTO books (id, key, title, author, language, pages, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const insertPage = db.prepare(
      'INSERT INTO pages (book_id, page, method, status, confidence) VALUES (?, ?, ?, ?, ?)',
    );
    const insertPassage = db.prepare(
      'INSERT INTO passages (book_id, page, ordinal, language, script, display_text) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const insertFts = db.prepare(
      'INSERT INTO passages_fts (rowid, my_tokens, latin_tokens) VALUES (?, ?, ?)',
    );
    db.exec('BEGIN');
    for await (const { book, pages, records } of loadBooks(
      options,
      pageCountOf,
    )) {
      insertBook.run(
        book.id,
        book.key,
        book.title,
        '',
        book.language,
        pages,
        records[0]?.sha256 ?? '',
      );
      const report: BookReport = {
        id: book.id,
        title: book.title,
        key: book.key,
        language: book.language,
        pages,
        recorded: records.length,
        passages: 0,
        byMethod: {},
        byStatus: {},
        missingPages: '',
      };
      for (const record of records) {
        engines.add(record.engine);
        count(report.byMethod, record.method);
        count(report.byStatus, record.status);
        insertPage.run(
          book.id,
          record.page,
          record.method,
          record.status,
          record.confidence,
        );
        for (const passage of record.passages) {
          const { lastInsertRowid } = insertPassage.run(
            book.id,
            record.page,
            passage.ordinal,
            passageLanguage(passage.script, book.language),
            passage.script,
            passage.text,
          );
          const tokens = ftsTokens(passage.text);
          insertFts.run(
            lastInsertRowid,
            tokens.my.join(' '),
            tokens.latin.join(' '),
          );
          report.passages += 1;
        }
      }
      const have = new Set(records.map((r) => r.page));
      report.missingPages = ranges(
        Array.from({ length: pages }, (_, i) => i + 1).filter(
          (p) => !have.has(p),
        ),
      );
      reports.push(report);
    }
    const totals = {
      books: reports.length,
      pages: reports.reduce((n, r) => n + r.pages, 0),
      recorded: reports.reduce((n, r) => n + r.recorded, 0),
      passages: reports.reduce((n, r) => n + r.passages, 0),
    };
    const manifestRev = createHash('sha256')
      .update(await readFile(manifestPath))
      .digest('hex')
      .slice(0, 12);
    const insertMeta = db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?)',
    );
    for (const [key, value] of Object.entries({
      schema_version: String(SCHEMA_VERSION),
      index_version: version,
      manifest_rev: manifestRev,
      extractor_version: String(EXTRACTOR_VERSION),
      engines: JSON.stringify([...engines].sort()),
      built_at: now.toISOString(),
      books: String(totals.books),
      pages: String(totals.pages),
      recorded_pages: String(totals.recorded),
      passages: String(totals.passages),
    }))
      insertMeta.run(key, value);
    db.exec('COMMIT');
    db.exec("INSERT INTO passages_fts (passages_fts) VALUES ('optimize')");
    db.exec('VACUUM');
    verify(db, totals);
    db.close();

    const sha256 = await sha256File(workFile);
    await rename(workFile, finalFile);
    await writeFile(
      `${finalFile}.sha256`,
      `${sha256}  ${path.basename(finalFile)}\n`,
    );
    const report: BuildReport = {
      version,
      builtAt: now.toISOString(),
      manifestRev,
      books: reports,
      totals,
      dbBytes: (await stat(finalFile)).size,
    };
    await writeFile(
      path.join(options.distDir, `library-search-${version}.report.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    log(
      `Built ${path.basename(finalFile)}: ${totals.books} books, ${totals.recorded}/${totals.pages} pages, ${totals.passages} passages, ${report.dbBytes} bytes`,
    );
    return { file: finalFile, sha256, report };
  } catch (error) {
    try {
      db.close();
    } catch {
      // already closed
    }
    await rm(workFile, { force: true });
    throw error;
  }
}

function verify(
  db: DatabaseSync,
  totals: { books: number; recorded: number; passages: number },
): void {
  const integrity = db.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || Object.values(integrity[0] ?? {})[0] !== 'ok')
    throw new Error(`integrity_check failed: ${JSON.stringify(integrity)}`);
  const n = (sql: string): number =>
    Number(Object.values(db.prepare(sql).get() ?? {})[0]);
  const expected: [string, number][] = [
    ['SELECT count(*) FROM books', totals.books],
    ['SELECT count(*) FROM pages', totals.recorded],
    ['SELECT count(*) FROM passages', totals.passages],
    ['SELECT count(*) FROM passages_fts', totals.passages],
  ];
  for (const [sql, want] of expected)
    if (n(sql) !== want)
      throw new Error(`${sql} returned ${n(sql)}, expected ${want}`);
}
