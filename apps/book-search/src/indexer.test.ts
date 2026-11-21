import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureBook, tempDir, writePdf } from '../test/helpers.ts';
import { workDir, workPaths } from './config.ts';
import { indexBook, type IndexOptions } from './indexer.ts';
import { ocrImage } from './ocr.ts';
import { pdfPageCount, renderPage } from './pdf.ts';
import { loadState, statePath } from './state.ts';
import { toolAvailable, toolVersions } from './tools.ts';

// These tests run the real Poppler (and, for the smoke test, Tesseract), so they are skipped
// on a machine without the tools; CI installs neither in stage 1.
const hasPoppler =
  toolAvailable('pdftotext', '-v') &&
  toolAvailable('pdfinfo', '-v') &&
  toolAvailable('pdftoppm', '-v');
const tessdata = workPaths(workDir()).tessdata;
const hasOcr =
  hasPoppler &&
  toolAvailable('tesseract', '--version') &&
  existsSync(path.join(tessdata, 'mya.traineddata')) &&
  existsSync(path.join(tessdata, 'eng.traineddata'));

const sentence = 'Dhamma talk on the four noble truths and the eightfold path';

async function options(
  dir: string,
  extra: Partial<IndexOptions> = {},
): Promise<IndexOptions> {
  return {
    stateDir: path.join(dir, 'state'),
    tmpDir: path.join(dir, 'tmp'),
    tessdataDir: tessdata,
    versions: { tesseract: '0', poppler: '0' },
    ocr: 'never',
    log: () => {},
    ...extra,
  };
}

describe.skipIf(!hasPoppler)('indexBook (text layer)', () => {
  it('records text pages and leaves a page that needs OCR pending when OCR is never', async () => {
    const dir = await tempDir();
    const pdf = await writePdf(dir, [sentence, `${sentence} again`, '12']);
    const book = fixtureBook();
    const summary = await indexBook(book, pdf, await options(dir));
    expect(summary).toMatchObject({
      pages: 3,
      done: 2,
      errors: 0,
      needsOcr: 1,
    });
    expect(summary.byStatus).toEqual({ ok: 2 });
    const records = await loadState(
      statePath(path.join(dir, 'state'), book.id),
    );
    expect(records.map((r) => [r.page, r.method, r.status])).toEqual([
      [1, 'text', 'ok'],
      [2, 'text', 'ok'],
    ]);
    expect(records[0]?.passages).toEqual([
      { ordinal: 1, script: 'latn', text: sentence },
    ]);
    expect(records[0]).toMatchObject({
      bookId: book.id,
      key: book.key,
      confidence: null,
    });
    // The pending page is still pending: a second run looks at it again.
    expect(await indexBook(book, pdf, await options(dir))).toMatchObject({
      done: 0,
      skipped: 2,
      needsOcr: 1,
    });
  });

  it('refuses --force together with --ocr never', async () => {
    const dir = await tempDir();
    const pdf = await writePdf(dir, [sentence]);
    await expect(
      indexBook(fixtureBook(), pdf, await options(dir, { force: true })),
    ).rejects.toThrow(/--ocr never/);
  });

  it('resumes: pages already in the state file are not redone', async () => {
    const dir = await tempDir();
    const pdf = await writePdf(dir, [sentence, sentence, sentence]);
    const book = fixtureBook();
    const first = await indexBook(
      book,
      pdf,
      await options(dir, { pages: { from: 1, to: 1 } }),
    );
    expect(first.done).toBe(1);
    const stamp = (
      await loadState(statePath(path.join(dir, 'state'), book.id))
    )[0]?.extractedAt;
    const second = await indexBook(book, pdf, await options(dir));
    expect(second).toMatchObject({ done: 2, skipped: 1 });
    const records = await loadState(
      statePath(path.join(dir, 'state'), book.id),
    );
    expect(records.map((r) => r.page)).toEqual([1, 2, 3]);
    expect(records[0]?.extractedAt).toBe(stamp);
  });

  it('refuses a changed PDF unless forced, then redoes every page', async () => {
    const dir = await tempDir();
    const book = fixtureBook();
    const pdf = await writePdf(dir, [sentence]);
    await indexBook(book, pdf, await options(dir));
    await writePdf(dir, [`${sentence} second edition`]);
    await expect(indexBook(book, pdf, await options(dir))).rejects.toThrow(
      /--force/,
    );
    const forced = await indexBook(
      book,
      pdf,
      await options(dir, { force: true, ocr: 'auto' }),
    );
    expect(forced.done).toBe(1);
    const records = await loadState(
      statePath(path.join(dir, 'state'), book.id),
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.passages[0]?.text).toContain('second edition');
  });

  it('--force with --pages redoes only those pages and keeps the rest', async () => {
    const dir = await tempDir();
    const book = fixtureBook();
    const pdf = await writePdf(dir, [sentence, sentence, sentence]);
    await indexBook(book, pdf, await options(dir));
    const forced = await indexBook(
      book,
      pdf,
      await options(dir, {
        force: true,
        ocr: 'auto',
        pages: { from: 2, to: 2 },
      }),
    );
    expect(forced).toMatchObject({ done: 1, skipped: 0 });
    const records = await loadState(
      statePath(path.join(dir, 'state'), book.id),
    );
    expect(records.map((r) => r.page).sort()).toEqual([1, 2, 3]);
  });

  it('names an unreadable PDF', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'broken.pdf');
    await writeFile(file, 'this is not a pdf');
    await expect(pdfPageCount(file)).rejects.toThrow(/not a readable PDF/);
    await expect(
      indexBook(fixtureBook(), file, await options(dir)),
    ).rejects.toThrow(/not a readable PDF/);
  });
});

describe.skipIf(!hasOcr)('indexBook (OCR smoke test)', () => {
  it('renders a page and reads it with the pinned models', async () => {
    const dir = await tempDir();
    const pdf = await writePdf(dir, ['Dhamma Pali teaching']);
    const book = fixtureBook();
    const logs: string[] = [];
    const summary = await indexBook(
      book,
      pdf,
      await options(dir, {
        ocr: 'always',
        versions: await toolVersions(),
        log: (line) => logs.push(line),
      }),
    );
    expect(summary, logs.join('\n')).toMatchObject({ done: 1, errors: 0 });
    const [record] = await loadState(
      statePath(path.join(dir, 'state'), book.id),
    );
    expect(record).toMatchObject({ method: 'ocr' });
    expect(record?.status).not.toBe('failed');
    expect(record?.engine).toMatch(
      /^tesseract \S+, tessdata_best e12c65a, mya\+eng$/,
    );
    expect(
      record?.passages
        .map((p) => p.text)
        .join(' ')
        .toLowerCase(),
    ).toContain('dhamma');
  }, 120_000);

  it('reads an image whose path starts with /tmp (Leptonica cannot open it directly on macOS)', async () => {
    const dir = await mkdtemp('/tmp/book-search-test-');
    try {
      const pdf = await writePdf(dir, ['Dhamma Pali teaching']);
      const image = await renderPage(pdf, 1, path.join(dir, 'page'));
      const paragraphs = await ocrImage(image, {
        tessdataDir: tessdata,
        langs: 'eng',
      });
      expect(paragraphs.map((p) => p.text).join(' ')).toContain('Dhamma');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
