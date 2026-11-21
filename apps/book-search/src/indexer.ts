import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { EXTRACTOR_VERSION } from './config.ts';
import { TESSDATA_COMMIT } from './models.ts';
import { meanConfidence, ocrImage } from './ocr.ts';
import { pdfPageCount, renderPage, sha256File, textLayer } from './pdf.ts';
import { checkTextLayer } from './quality.ts';
import type { PageRecord } from './record.ts';
import {
  appendRecord,
  loadState,
  resetState,
  rewriteState,
  statePath,
} from './state.ts';
import type { ToolVersions } from './tools.ts';
import { ocrPassages, scriptOf, textParagraphs } from './text.ts';
import type { Book } from './library.ts';

/** Below this mean word confidence an OCR page is `suspect` (to be tuned in the pilot). */
export const SUSPECT_CONFIDENCE = 0.6;

export interface IndexOptions {
  stateDir: string;
  tmpDir: string;
  tessdataDir: string;
  versions: ToolVersions;
  /** auto: OCR only pages whose text layer is unusable; always: OCR every page; never: no OCR. */
  ocr: 'auto' | 'always' | 'never';
  /** Redo every page even if the state file has it. */
  force?: boolean;
  /** Only these physical pages (inclusive), for trying a book out. */
  pages?: { from: number; to: number };
  log: (line: string) => void;
}

export interface IndexSummary {
  bookId: string;
  pages: number;
  done: number;
  skipped: number;
  errors: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
}

export const ocrEngine = (v: ToolVersions): string =>
  `tesseract ${v.tesseract}, tessdata_best ${TESSDATA_COMMIT.slice(0, 7)}, mya+eng`;
export const textEngine = (v: ToolVersions): string => `pdftotext ${v.poppler}`;

/**
 * Extracts every page of one PDF into `state/<bookId>.jsonl`, one record per page, appended as
 * each page finishes so an interrupted run resumes at the next page. Pages whose extraction
 * throws are not recorded (they are retried next run) and counted in `errors`.
 */
export async function indexBook(
  book: Book,
  pdfFile: string,
  options: IndexOptions,
): Promise<IndexSummary> {
  const file = statePath(options.stateDir, book.id);
  const sha256 = await sha256File(pdfFile);
  const pageCount = await pdfPageCount(pdfFile);
  const from = Math.max(1, options.pages?.from ?? 1);
  const to = Math.min(pageCount, options.pages?.to ?? pageCount);
  const records = await prepareState(
    file,
    sha256,
    from,
    to,
    options.force ?? false,
    book.id,
  );
  const done = new Set(records.map((record) => record.page));

  const pending = Array.from(
    { length: to - from + 1 },
    (_, i) => from + i,
  ).filter((page) => !done.has(page));
  const layer =
    options.ocr === 'always' || pending.length === 0
      ? []
      : await textLayer(pdfFile, pageCount);
  await mkdir(options.tmpDir, { recursive: true });

  const summary: IndexSummary = {
    bookId: book.id,
    pages: pageCount,
    done: 0,
    skipped: to - from + 1 - pending.length,
    errors: 0,
    byMethod: {},
    byStatus: {},
  };
  for (const page of pending) {
    try {
      const record = await extractPage({
        book,
        pdfFile,
        sha256,
        page,
        layerText: layer[page - 1] ?? '',
        options,
      });
      await appendRecord(file, record);
      summary.done += 1;
      summary.byMethod[record.method] =
        (summary.byMethod[record.method] ?? 0) + 1;
      summary.byStatus[record.status] =
        (summary.byStatus[record.status] ?? 0) + 1;
      if (summary.done % 10 === 0)
        options.log(`${book.id}: ${summary.done}/${pending.length} pages`);
    } catch (error) {
      summary.errors += 1;
      options.log(
        `${book.id}: page ${page} failed, will retry next run: ${(error instanceof
        Error
          ? error.message
          : String(error)
        )
          .replace(/\s*\n\s*/g, ' / ')
          .slice(0, 600)}`,
      );
    }
  }
  return summary;
}

/**
 * Loads a book's records and applies --force: records from a different PDF or extractor
 * version are stale (refused unless forced, then dropped); a plain --force drops only the
 * pages in the requested range.
 */
async function prepareState(
  file: string,
  sha256: string,
  from: number,
  to: number,
  force: boolean,
  bookId: string,
): Promise<PageRecord[]> {
  const records = await loadState(file);
  const first = records[0];
  const stale =
    first !== undefined &&
    (first.sha256 !== sha256 || first.extractorVersion !== EXTRACTOR_VERSION);
  if (stale && !force)
    throw new Error(
      `${bookId}: state was made from a different PDF or extractor version; run with --force to redo it`,
    );
  if (stale) {
    await resetState(file);
    return [];
  }
  if (!force) return records;
  const kept = records.filter((r) => r.page < from || r.page > to);
  if (kept.length !== records.length) await rewriteState(file, kept);
  return kept;
}

interface PageJob {
  book: Book;
  pdfFile: string;
  sha256: string;
  page: number;
  layerText: string;
  options: IndexOptions;
}

async function extractPage(job: PageJob): Promise<PageRecord> {
  const { book, options, page } = job;
  const base = {
    v: 1 as const,
    bookId: book.id,
    key: book.key,
    sha256: job.sha256,
    page,
    extractorVersion: EXTRACTOR_VERSION,
    extractedAt: new Date().toISOString(),
  };
  const verdict =
    options.ocr === 'always'
      ? { usable: false, reasons: [] as string[] }
      : checkTextLayer(job.layerText, book.language);
  if (verdict.usable) {
    const passages = textParagraphs(job.layerText).map((text, i) => ({
      ordinal: i + 1,
      script: scriptOf(text),
      text,
    }));
    return {
      ...base,
      method: 'text',
      engine: textEngine(options.versions),
      status: 'ok',
      confidence: null,
      reasons: [],
      passages,
    };
  }
  if (options.ocr === 'never')
    return {
      ...base,
      method: 'text',
      engine: textEngine(options.versions),
      status: 'failed',
      confidence: null,
      reasons: [...verdict.reasons, 'ocr_disabled'],
      passages: [],
    };

  const prefix = path.join(options.tmpDir, `${book.id}-${page}`);
  try {
    const image = await renderPage(job.pdfFile, page, prefix);
    const paragraphs = await ocrImage(image, {
      tessdataDir: options.tessdataDir,
    });
    const texts = ocrPassages(paragraphs.map((p) => p.text));
    const confidence = meanConfidence(paragraphs);
    const reasons: string[] = [...verdict.reasons];
    let status: PageRecord['status'] = 'ok';
    if (texts.length === 0) {
      status = 'failed';
      reasons.push('no_text');
    } else if (confidence < SUSPECT_CONFIDENCE) {
      status = 'suspect';
      reasons.push('low_confidence');
    }
    return {
      ...base,
      method: 'ocr',
      engine: ocrEngine(options.versions),
      status,
      confidence: texts.length ? confidence : null,
      reasons,
      passages: texts.map((text, i) => ({
        ordinal: i + 1,
        script: scriptOf(text),
        text,
      })),
    };
  } finally {
    await rm(`${prefix}.png`, { force: true });
  }
}
