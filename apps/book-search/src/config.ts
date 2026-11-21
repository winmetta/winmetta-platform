import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

/** Bump when extraction rules change, so old page records are not mixed with new ones. */
export const EXTRACTOR_VERSION = 2;

/** Public CDN the library PDFs are served from (the website's PUBLIC_LIBRARY_CDN_BASE). */
export const DEFAULT_CDN_BASE = 'https://dhamma-library.b-cdn.net';

export const cdnBase = (env: NodeJS.ProcessEnv = process.env): string =>
  env['PUBLIC_LIBRARY_CDN_BASE'] || DEFAULT_CDN_BASE;

/** The gitignored work folder; BOOK_SEARCH_WORK_DIR overrides it. */
export const workDir = (env: NodeJS.ProcessEnv = process.env): string =>
  path.resolve(
    env['BOOK_SEARCH_WORK_DIR'] || path.join(repoRoot, '.cache', 'book-search'),
  );

export const workPaths = (dir: string) => ({
  tessdata: path.join(dir, 'tessdata'),
  pdfs: path.join(dir, 'pdfs'),
  state: path.join(dir, 'state'),
  tmp: path.join(dir, 'tmp'),
  dist: path.join(dir, 'dist'),
});

export const manifestPath = path.join(
  repoRoot,
  'apps/web/src/library/manifest.json',
);
export const pilotBooksPath = path.join(
  repoRoot,
  'apps/book-search/pilot/books.json',
);

/** The API the CLI and the golden queries call when no base URL is given: the local server. */
export const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
