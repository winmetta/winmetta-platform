import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { run } from './tools.ts';

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Physical page count from `pdfinfo`; throws a clear error for unreadable PDFs. */
export async function pdfPageCount(file: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await run('pdfinfo', [file], { timeoutMs: 60000 }));
  } catch (error) {
    throw new Error(
      `${path.basename(file)} is not a readable PDF (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`,
      { cause: error },
    );
  }
  const pages = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1]);
  if (!Number.isInteger(pages) || pages < 1)
    throw new Error(`${path.basename(file)} has no pages`);
  return pages;
}

/** The text layer of every page, in physical order (pdftotext separates pages with a form feed). */
export async function textLayer(
  file: string,
  pages: number,
): Promise<string[]> {
  const { stdout } = await run('pdftotext', [
    '-layout',
    '-enc',
    'UTF-8',
    file,
    '-',
  ]);
  const perPage = stdout.split('\f');
  return Array.from({ length: pages }, (_, i) => perPage[i] ?? '');
}

/** Renders one page to `<outPrefix>.png` (grey, `dpi`) and returns that path. */
export async function renderPage(
  file: string,
  page: number,
  outPrefix: string,
  dpi = 300,
): Promise<string> {
  await run('pdftoppm', [
    '-r',
    String(dpi),
    '-gray',
    '-png',
    '-singlefile',
    '-f',
    String(page),
    '-l',
    String(page),
    file,
    outPrefix,
  ]);
  return `${outPrefix}.png`;
}
