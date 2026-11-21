import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileUrl } from '../../web/src/lib/library-index.ts';
import type { Book } from './library.ts';

/**
 * Copies one library PDF from the public CDN to `<pdfsDir>/<bookId>.pdf` and checks its size
 * against the manifest. A file that is already there with the right size is kept.
 */
export async function fetchBook(
  book: Book,
  options: {
    pdfsDir: string;
    cdnBase: string;
    log: (line: string) => void;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const target = path.join(options.pdfsDir, `${book.id}.pdf`);
  const existing = await stat(target).catch(() => undefined);
  if (existing?.size === book.sizeBytes) {
    options.log(`${book.id}: already fetched`);
    return target;
  }
  await mkdir(options.pdfsDir, { recursive: true });
  const url = fileUrl(options.cdnBase, book.key);
  options.log(`${book.id}: fetching ${url}`);
  const response = await (options.fetchImpl ?? fetch)(url);
  if (!response.ok || !response.body)
    throw new Error(`${book.id}: download failed (HTTP ${response.status})`);
  const part = `${target}.part`;
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import('node:stream/web').ReadableStream,
      ),
      createWriteStream(part),
    );
    const size = (await stat(part)).size;
    if (size !== book.sizeBytes)
      throw new Error(
        `${book.id}: downloaded ${size} bytes, the manifest says ${book.sizeBytes}`,
      );
    await rename(part, target);
  } catch (error) {
    await rm(part, { force: true });
    throw error;
  }
  return target;
}
