import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ftsTokens, normalizeSearch } from '@winmetta/search-text';
import { describe, expect, it } from 'vitest';
import { tempDir } from '../test/helpers.ts';
import { buildIndex, nextVersion, passageLanguage, ranges } from './builder.ts';
import { EXTRACTOR_VERSION } from './config.ts';
import type { Book } from './library.ts';
import type { PageRecord } from './record.ts';
import { appendRecord, statePath } from './state.ts';

const burmeseBook: Book = {
  id: 'aaaaaaaaaaaa',
  key: 'my/Book A.pdf',
  title: 'ဓမ္မ စာအုပ်',
  language: 'my',
  sizeBytes: 1,
};
const englishBook: Book = {
  id: 'bbbbbbbbbbbb',
  key: 'en/Book B.pdf',
  title: 'Book B',
  language: 'en',
  sizeBytes: 1,
};

function record(
  book: Book,
  page: number,
  texts: [string, 'my' | 'latn' | 'mixed'][],
  extra: Partial<PageRecord> = {},
): PageRecord {
  return {
    v: 1,
    bookId: book.id,
    key: book.key,
    sha256: (book.id[0] ?? 'a').repeat(64),
    page,
    method: 'text',
    engine: 'pdftotext 1',
    extractorVersion: EXTRACTOR_VERSION,
    status: 'ok',
    confidence: null,
    reasons: [],
    passages: texts.map(([text, script], i) => ({
      ordinal: i + 1,
      script,
      text,
    })),
    extractedAt: '2026-11-20T21:00:00.000Z',
    ...extra,
  };
}

async function fixture(): Promise<{
  dir: string;
  stateDir: string;
  distDir: string;
}> {
  const dir = await tempDir();
  const stateDir = path.join(dir, 'state');
  const write = (r: PageRecord) =>
    appendRecord(statePath(stateDir, r.bookId), r);
  await write(
    record(burmeseBook, 1, [
      ['ဓမ္မဒေသနာ တော်', 'my'],
      ['Pāḷi text', 'mixed'],
    ]),
  );
  await write(
    record(burmeseBook, 2, [['သီလ သမာဓိ ပညာ', 'my']], {
      method: 'ocr',
      engine: 'tesseract 5, mya+eng',
      confidence: 0.8,
    }),
  );
  await write(
    record(burmeseBook, 3, [], {
      method: 'ocr',
      engine: 'tesseract 5, mya+eng',
      status: 'failed',
      reasons: ['no_text'],
    }),
  );
  await write(
    record(englishBook, 1, [['The four noble truths, Dhammā.', 'latn']]),
  );
  await write(
    record(englishBook, 2, [['A low confidence page', 'latn']], {
      method: 'ocr',
      status: 'suspect',
      confidence: 0.4,
    }),
  );
  return { dir, stateDir, distDir: path.join(dir, 'dist') };
}

const pages = async (book: Book): Promise<number> =>
  book.id === burmeseBook.id ? 3 : 2;
const now = () => new Date('2026-11-20T22:00:00Z');

describe('buildIndex', () => {
  it('builds the tables, a checksum and a report that account for every book and page', async () => {
    const f = await fixture();
    const result = await buildIndex({
      books: [englishBook, burmeseBook],
      stateDir: f.stateDir,
      pdfsDir: f.dir,
      distDir: f.distDir,
      pageCount: pages,
      now,
      log: () => {},
    });
    expect(path.basename(result.file)).toBe(
      'library-search-2026-11-20-r1.sqlite',
    );
    expect(await readdir(f.distDir)).toEqual([
      'library-search-2026-11-20-r1.report.json',
      'library-search-2026-11-20-r1.sqlite',
      'library-search-2026-11-20-r1.sqlite.sha256',
    ]);
    const sha = createHash('sha256')
      .update(await readFile(result.file))
      .digest('hex');
    expect(sha).toBe(result.sha256);
    expect(await readFile(`${result.file}.sha256`, 'utf8')).toBe(
      `${sha}  library-search-2026-11-20-r1.sqlite\n`,
    );
    expect(result.report.totals).toEqual({
      books: 2,
      pages: 5,
      recorded: 5,
      passages: 5,
    });
    const aReport = result.report.books.find((b) => b.id === burmeseBook.id);
    expect(aReport).toMatchObject({
      pages: 3,
      recorded: 3,
      passages: 3,
      byMethod: { text: 1, ocr: 2 },
      byStatus: { ok: 2, failed: 1 },
      missingPages: '',
    });

    const db = new DatabaseSync(result.file, { readOnly: true });
    const one = (sql: string) => Object.values(db.prepare(sql).get() ?? {})[0];
    expect(one('SELECT count(*) FROM books')).toBe(2);
    expect(one('SELECT count(*) FROM pages')).toBe(5);
    expect(one('SELECT count(*) FROM passages')).toBe(5);
    expect(one('SELECT count(*) FROM passages_fts')).toBe(5);
    expect(one("SELECT value FROM meta WHERE key = 'index_version'")).toBe(
      '2026-11-20-r1',
    );
    expect(one("SELECT value FROM meta WHERE key = 'schema_version'")).toBe(
      '1',
    );
    expect(
      JSON.parse(String(one("SELECT value FROM meta WHERE key = 'engines'"))),
    ).toEqual(['pdftotext 1', 'tesseract 5, mya+eng']);
    expect(
      String(one("SELECT value FROM meta WHERE key = 'manifest_rev'")),
    ).toMatch(/^[0-9a-f]{12}$/);
    // A failed page has a pages row but no passages; a suspect page is indexed.
    expect(
      one(
        "SELECT status FROM pages WHERE book_id = 'aaaaaaaaaaaa' AND page = 3",
      ),
    ).toBe('failed');
    expect(
      one(
        "SELECT count(*) FROM passages WHERE book_id = 'aaaaaaaaaaaa' AND page = 3",
      ),
    ).toBe(0);
    expect(
      one(
        "SELECT count(*) FROM passages WHERE book_id = 'bbbbbbbbbbbb' AND page = 2",
      ),
    ).toBe(1);
    expect(one('PRAGMA integrity_check')).toBe('ok');
    db.close();
  });

  it('finds a Burmese syllable phrase whatever the spacing, and Latin text without accents', async () => {
    const f = await fixture();
    const { file } = await buildIndex({
      books: [burmeseBook, englishBook],
      stateDir: f.stateDir,
      pdfsDir: f.dir,
      distDir: f.distDir,
      pageCount: pages,
      now,
      log: () => {},
    });
    const db = new DatabaseSync(file, { readOnly: true });
    const find = (
      column: string,
      words: string,
    ): { book_id: string; page: number }[] =>
      db
        .prepare(
          `SELECT p.book_id, p.page FROM passages_fts f JOIN passages p ON p.id = f.rowid WHERE passages_fts MATCH ? ORDER BY p.book_id, p.page`,
        )
        .all(`${column}:"${words}"`) as never;
    const phrase = ftsTokens(normalizeSearch('ဓမ္မ ဒေသနာ')).my.join(' ');
    expect(find('my_tokens', phrase)).toEqual([
      { book_id: 'aaaaaaaaaaaa', page: 1 },
    ]);
    expect(find('latin_tokens', 'pali')).toEqual([
      { book_id: 'aaaaaaaaaaaa', page: 1 },
    ]);
    expect(find('latin_tokens', 'dhamma')).toEqual([
      { book_id: 'bbbbbbbbbbbb', page: 1 },
    ]);
    // Display text keeps the original spelling.
    const shown = db
      .prepare(
        "SELECT display_text FROM passages WHERE book_id = 'bbbbbbbbbbbb' AND page = 1",
      )
      .get() as { display_text: string };
    expect(shown.display_text).toBe('The four noble truths, Dhammā.');
    db.close();
  });

  it('stores the passage language: Burmese script is my, Latin is en only in English books', async () => {
    const f = await fixture();
    const { file } = await buildIndex({
      books: [burmeseBook, englishBook],
      stateDir: f.stateDir,
      pdfsDir: f.dir,
      distDir: f.distDir,
      pageCount: pages,
      now,
      log: () => {},
    });
    const db = new DatabaseSync(file, { readOnly: true });
    const rows = db
      .prepare(
        'SELECT book_id, page, ordinal, language FROM passages ORDER BY id',
      )
      .all();
    expect(
      rows.map(
        (r) => `${r['book_id']}.${r['page']}.${r['ordinal']}=${r['language']}`,
      ),
    ).toEqual([
      'aaaaaaaaaaaa.1.1=my',
      'aaaaaaaaaaaa.1.2=my',
      'aaaaaaaaaaaa.2.1=my',
      'bbbbbbbbbbbb.1.1=en',
      'bbbbbbbbbbbb.2.1=en',
    ]);
    db.close();
    expect(passageLanguage('latn', 'my')).toBe('und');
    expect(passageLanguage('mixed', 'my')).toBe('my');
    expect(passageLanguage('my', 'en')).toBe('my');
  });

  it('refuses an incomplete book, writing nothing, unless told to allow it', async () => {
    const f = await fixture();
    const incomplete = async (b: Book): Promise<number> =>
      b.id === burmeseBook.id ? 6 : 2;
    await expect(
      buildIndex({
        books: [burmeseBook],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: incomplete,
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/aaaaaaaaaaaa: 3 of 6 pages have no record/);
    expect(await readdir(f.distDir)).toEqual([]);
    const result = await buildIndex({
      books: [burmeseBook],
      stateDir: f.stateDir,
      pdfsDir: f.dir,
      distDir: f.distDir,
      pageCount: incomplete,
      allowIncomplete: true,
      now,
      log: () => {},
    });
    expect(result.report.books[0]).toMatchObject({
      pages: 6,
      recorded: 3,
      missingPages: '4-6',
    });
  });

  it('refuses a book with no records, a page beyond the PDF, or a page recorded twice', async () => {
    const f = await fixture();
    const ghost: Book = { ...englishBook, id: 'cccccccccccc' };
    await expect(
      buildIndex({
        books: [ghost],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: pages,
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/cccccccccccc: no page records/);
    await expect(
      buildIndex({
        books: [burmeseBook],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: async () => 2,
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/page 3 is beyond the PDF's 2 pages/);
    await appendRecord(
      statePath(f.stateDir, englishBook.id),
      record(englishBook, 1, [['again', 'latn']]),
    );
    await expect(
      buildIndex({
        books: [englishBook],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: pages,
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/page 1 is recorded twice/);
  });

  it('refuses to build an empty index', async () => {
    const f = await fixture();
    await expect(
      buildIndex({
        books: [],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: pages,
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/No books to build/);
  });

  it('numbers revisions and never overwrites a release', async () => {
    const f = await fixture();
    const base = {
      books: [englishBook],
      stateDir: f.stateDir,
      pdfsDir: f.dir,
      distDir: f.distDir,
      pageCount: pages,
      now,
      log: () => {},
    };
    expect(path.basename((await buildIndex(base)).file)).toContain(
      '2026-11-20-r1',
    );
    expect(path.basename((await buildIndex(base)).file)).toContain(
      '2026-11-20-r2',
    );
    await expect(
      buildIndex({ ...base, version: '2026-11-20-r1' }),
    ).rejects.toThrow(/never overwritten/);
    expect(await nextVersion(f.distDir, now())).toBe('2026-11-20-r3');
  });

  it('removes its working file when a check fails', async () => {
    const f = await fixture();
    await writeFile(path.join(f.dir, 'x'), '');
    await expect(
      buildIndex({
        books: [englishBook],
        stateDir: f.stateDir,
        pdfsDir: f.dir,
        distDir: f.distDir,
        pageCount: async () => {
          throw new Error('boom');
        },
        now,
        log: () => {},
      }),
    ).rejects.toThrow(/boom/);
    expect(await readdir(f.distDir)).toEqual([]);
  });
});

describe('ranges', () => {
  it('writes page lists as ranges', () => {
    expect(ranges([])).toBe('');
    expect(ranges([5])).toBe('5');
    expect(ranges([1, 2, 3, 7, 9, 10])).toBe('1-3,7,9-10');
  });
});
