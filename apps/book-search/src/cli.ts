import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cdnBase, workDir, workPaths } from './config.ts';
import { buildIndex } from './builder.ts';
import { fetchBook } from './fetch.ts';
import { indexBook } from './indexer.ts';
import { loadManifest, loadPilotIds, pickBooks, type Book } from './library.ts';
import { ensureModels, MODELS, verifyModel } from './models.ts';
import { toolVersions } from './tools.ts';

const usage = `Usage: npm run book-search:<command> -- [options] [bookId...]

  setup   check Tesseract and Poppler, download and verify the pinned OCR models
  fetch   copy PDFs from the public CDN into the work folder
  index   extract text (text layer, OCR where needed) into state/<bookId>.jsonl
  build   build dist/library-search-<version>.sqlite from the page records

Books are named by manifest id, or --pilot for apps/book-search/pilot/books.json.
\`index\` with no books indexes every PDF already in the work folder; \`build\` with no
books uses every book that has page records.

Options:
  --pilot            use the pilot list
  --ocr <mode>       auto (default), always or never
  --pages <a-b>      only these physical pages
  --force            redo pages that are already in the state file
  --version <name>   build: version name (default: today's date and the next revision)
  --allow-incomplete build: include books with pages that have no record
`;

const log = (line: string): void => console.log(line);

async function idsInFolder(
  folder: string,
  extension: string,
): Promise<string[]> {
  const names = await readdir(folder).catch(() => [] as string[]);
  return names
    .filter((name) => name.endsWith(extension))
    .map((name) => path.basename(name, extension))
    .sort();
}

function parsePages(
  value: string | undefined,
): { from: number; to: number } | undefined {
  if (!value) return undefined;
  const match = /^(\d+)(?:-(\d+))?$/.exec(value);
  const from = Number(match?.[1]);
  const to = Number(match?.[2] ?? match?.[1]);
  if (!match || from < 1 || to < from)
    throw new Error(`--pages must look like 5 or 3-9, got "${value}"`);
  return { from, to };
}

interface Parsed {
  command: string | undefined;
  ids: string[];
  pilot: boolean;
  ocr: string;
  pages: string | undefined;
  force: boolean;
  version: string | undefined;
  allowIncomplete: boolean;
  help: boolean;
}

function parseCli(): Parsed {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      pilot: { type: 'boolean' },
      ocr: { type: 'string' },
      pages: { type: 'string' },
      force: { type: 'boolean' },
      version: { type: 'string' },
      'allow-incomplete': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  const [command, ...ids] = positionals;
  return {
    command,
    ids,
    pilot: values.pilot ?? false,
    ocr: values.ocr ?? 'auto',
    pages: values.pages,
    force: values.force ?? false,
    version: values.version,
    allowIncomplete: values['allow-incomplete'] ?? false,
    help: values.help ?? false,
  };
}

async function runSetup(tessdata: string, dir: string): Promise<number> {
  const versions = await toolVersions();
  log(`tesseract ${versions.tesseract}, poppler ${versions.poppler}`);
  await ensureModels(tessdata, log);
  log(`Work folder: ${dir}`);
  return 0;
}

async function chooseBooks(
  args: Parsed,
  paths: ReturnType<typeof workPaths>,
): Promise<Book[]> {
  const manifest = await loadManifest();
  const wanted = args.pilot ? await loadPilotIds() : args.ids;
  if (wanted.length > 0) return pickBooks(manifest, wanted);
  if (args.command === 'index')
    return pickBooks(manifest, await idsInFolder(paths.pdfs, '.pdf'));
  if (args.command === 'build')
    return pickBooks(manifest, await idsInFolder(paths.state, '.jsonl'));
  return [];
}

async function runIndex(
  args: Parsed,
  books: Book[],
  paths: ReturnType<typeof workPaths>,
): Promise<number> {
  const { ocr } = args;
  if (ocr !== 'auto' && ocr !== 'always' && ocr !== 'never')
    throw new Error(`--ocr must be auto, always or never, got "${ocr}"`);
  const versions = await toolVersions();
  if (ocr !== 'never')
    for (const model of MODELS)
      if ((await verifyModel(paths.tessdata, model)) !== 'ok')
        throw new Error(
          `OCR model ${model.lang} is missing or does not match the pinned hash; run npm run book-search:setup`,
        );
  const pages = parsePages(args.pages);
  let errors = 0;
  for (const book of books) {
    const summary = await indexBook(
      book,
      path.join(paths.pdfs, `${book.id}.pdf`),
      {
        stateDir: paths.state,
        tmpDir: paths.tmp,
        tessdataDir: paths.tessdata,
        versions,
        ocr,
        force: args.force,
        ...(pages ? { pages } : {}),
        log,
      },
    );
    errors += summary.errors;
    log(
      `${book.id}: ${summary.pages} pages, ${summary.done} extracted, ${summary.skipped} already done, ${summary.errors} errors, ${summary.needsOcr} need OCR; ` +
        `methods ${JSON.stringify(summary.byMethod)}, status ${JSON.stringify(summary.byStatus)}`,
    );
  }
  return errors > 0 ? 2 : 0;
}

async function main(): Promise<number> {
  const args = parseCli();
  if (args.help || !args.command) {
    console.log(usage);
    return args.command ? 0 : 1;
  }
  const dir = workDir();
  const paths = workPaths(dir);
  if (args.command === 'setup') return runSetup(paths.tessdata, dir);
  if (!['fetch', 'index', 'build'].includes(args.command)) {
    console.error(`Unknown command "${args.command}"\n\n${usage}`);
    return 1;
  }
  const books = await chooseBooks(args, paths);
  if (books.length === 0) {
    console.error('No books named. Pass manifest ids or --pilot.');
    return 1;
  }
  if (args.command === 'fetch') {
    for (const book of books)
      await fetchBook(book, { pdfsDir: paths.pdfs, cdnBase: cdnBase(), log });
    return 0;
  }
  if (args.command === 'build') {
    await buildIndex({
      books,
      stateDir: paths.state,
      pdfsDir: paths.pdfs,
      distDir: paths.dist,
      ...(args.version ? { version: args.version } : {}),
      allowIncomplete: args.allowIncomplete,
      log,
    });
    return 0;
  }
  return runIndex(args, books, paths);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
