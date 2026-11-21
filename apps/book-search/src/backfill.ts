import { appendFile, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cdnBase, workDir, workPaths } from './config.ts';
import { fetchBook } from './fetch.ts';
import { indexBook } from './indexer.ts';
import { loadManifest } from './library.ts';
import { MODELS, verifyModel } from './models.ts';
import { toolVersions } from './tools.ts';

async function runBackfill(directory: string, workers: number): Promise<void> {
  const paths = workPaths(directory);
  const versions = await toolVersions();
  for (const model of MODELS) {
    if ((await verifyModel(paths.tessdata, model)) !== 'ok')
      throw new Error(
        `OCR model ${model.lang} is missing or invalid. Run book-search:setup.`,
      );
  }
  const books = (await loadManifest()).sort(
    (a, b) => a.sizeBytes - b.sizeBytes,
  );
  const progress = path.join(directory, 'backfill-progress.jsonl');
  const log = (line: string) => console.log(new Date().toISOString(), line);
  const pending = books.values();
  let failed = 0;

  async function worker(): Promise<void> {
    for (const book of pending) {
      try {
        const pdf = await fetchBook(book, {
          pdfsDir: paths.pdfs,
          cdnBase: cdnBase(),
          fetchImpl: (url) =>
            fetch(url, { signal: AbortSignal.timeout(1_800_000) }),
          log,
        });
        const summary = await indexBook(book, pdf, {
          stateDir: paths.state,
          tmpDir: paths.tmp,
          tessdataDir: paths.tessdata,
          versions,
          ocr: 'auto',
          log,
        });
        await appendFile(progress, JSON.stringify(summary) + '\n');
        log(
          `${book.id}: ${summary.done} extracted, ${summary.skipped} resumed, ${summary.errors} errors`,
        );
        if (summary.errors > 0) failed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        await appendFile(
          progress,
          JSON.stringify({ bookId: book.id, error: message }) + '\n',
        );
        log(`${book.id}: ${message}`);
      }
    }
  }

  log(`Starting ${books.length} PDFs with ${workers} workers`);
  const results = await Promise.allSettled(
    Array.from({ length: workers }, worker),
  );
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
  }
  log(`Finished backfill pass with ${failed} books needing attention`);
  if (failed > 0) process.exitCode = 2;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { workers: { type: 'string' } } });
  const workers = Number(values.workers ?? '4');
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw new Error('--workers must be a positive integer');
  process.env.OMP_THREAD_LIMIT ??= '1';
  const directory = workDir();
  await mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, 'backfill.lock');
  const lock = await open(lockPath, 'wx').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST')
        throw new Error(
          `Another backfill may be running. Check ${lockPath} before restarting.`,
        );
      throw error;
    },
  );
  try {
    await lock.writeFile(`${process.pid}\n`);
    await runBackfill(directory, workers);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
