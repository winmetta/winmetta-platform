import path from 'node:path';
import { buildIndex } from '../src/builder.ts';
import { EXTRACTOR_VERSION } from '../src/config.ts';
import type { Book } from '../src/library.ts';
import type { PageRecord } from '../src/record.ts';
import { appendRecord, statePath } from '../src/state.ts';
import { tempDir } from './helpers.ts';

export const burmeseBook: Book = {
  id: 'aaaaaaaaaaaa',
  key: 'ပါဠိတော်/Book A.pdf',
  title: 'ဓမ္မ စာအုပ်',
  language: 'my',
  sizeBytes: 1,
};
export const englishBook: Book = {
  id: 'bbbbbbbbbbbb',
  key: 'en/Book B.pdf',
  title: 'Book B',
  language: 'en',
  sizeBytes: 1,
};

const record = (
  book: Book,
  page: number,
  texts: [string, 'my' | 'latn' | 'mixed'][],
  extra: Partial<PageRecord> = {},
): PageRecord => ({
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
});

/** A small built index with Burmese, English and mixed passages, for API tests. */
export async function buildFixtureIndex(): Promise<{
  file: string;
  dir: string;
}> {
  const dir = await tempDir();
  const stateDir = path.join(dir, 'state');
  const write = (r: PageRecord) =>
    appendRecord(statePath(stateDir, r.bookId), r);
  await write(
    record(burmeseBook, 1, [
      ['ဓမ္မဒေသနာ တော် ကို နာယူရန်', 'my'],
      ['See Pāḷi text: Dhammā.', 'mixed'],
    ]),
  );
  await write(
    record(burmeseBook, 2, [['သီလ သမာဓိ ပညာ သုံးမျိုး', 'my']], {
      method: 'ocr',
      engine: 'tesseract 5, mya+eng',
      confidence: 0.82,
    }),
  );
  await write(
    record(englishBook, 1, [
      ['The four noble truths were taught at Sarnath.', 'latn'],
    ]),
  );
  await write(
    record(englishBook, 2, [
      ['Truths and the eightfold path. The path to peace.', 'latn'],
      ['An unrelated passage about monastery rules.', 'latn'],
    ]),
  );
  const { file } = await buildIndex({
    books: [burmeseBook, englishBook],
    stateDir,
    pdfsDir: dir,
    distDir: path.join(dir, 'dist'),
    pageCount: async () => 2,
    now: () => new Date('2026-11-20T22:00:00Z'),
    log: () => {},
  });
  return { file, dir };
}
