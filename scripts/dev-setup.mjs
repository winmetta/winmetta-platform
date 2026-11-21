// What `npm run dev` / `just dev` sets up for the local stand-ins, or asks about, before it
// starts (scripts/dev.mjs). Kept free of process and terminal calls: they are passed in, so the
// steps can be tested without running anything.

/** The pilot books `npm run dev` indexes for a first local index (marked "dev" in books.json). */
export function devBookIds(pilot) {
  return pilot.books.filter((book) => book.dev).map((book) => book.id);
}

const installHint = `  Poppler (pdftotext, pdfinfo, pdftoppm) reads the PDFs. Install it with:
    brew install poppler        (docs/developer-guide.md §2, "Book search tools")`;

/**
 * Makes sure Search inside PDFs has an index to serve, creating what is missing:
 *   - an index already built: nothing to do;
 *   - Poppler missing: offer to install it with Homebrew (only on a terminal), else say how;
 *   - then fetch the dev books from the public CDN and build a small index from their text
 *     layer (no OCR, so Tesseract and its models are not needed; pages that need OCR are left
 *     out), which takes seconds.
 * Returns whether an index exists afterwards. It never throws: a failed step is reported and
 * the dev server starts without book search.
 *
 * deps: hasIndex(), hasTool(name), run(command, args) -> exit status, ask(question) ->
 * boolean, interactive, log(line), ids.
 */
export async function ensureBookSearchIndex(deps) {
  const { hasIndex, hasTool, run, ask, interactive, log, ids } = deps;
  if (hasIndex()) return true;
  if (ids.length === 0) {
    log('! No dev books are marked in apps/book-search/pilot/books.json.');
    return false;
  }
  if (!hasTool('pdftotext')) {
    log(
      `! Search inside PDFs needs a local index, and building one needs Poppler:\n${installHint}`,
    );
    const canOffer = interactive && hasTool('brew');
    if (!canOffer || !(await ask('Run `brew install poppler` now?'))) {
      log(
        '  Skipping Search inside PDFs this time (install Poppler and start again).',
      );
      return false;
    }
    if (run('brew', ['install', 'poppler']) !== 0 || !hasTool('pdftotext')) {
      log('! Poppler did not install; skipping Search inside PDFs.');
      return false;
    }
  }
  log(
    `Search inside PDFs: no local index yet, so building a small one from ${ids.length} public library books (text layer only, no OCR). This happens once.`,
  );
  const steps = [
    ['book-search:fetch', ids],
    ['book-search:index', [...ids, '--ocr', 'never']],
    ['book-search:build', [...ids, '--allow-incomplete']],
  ];
  for (const [script, args] of steps) {
    if (run('npm', ['run', script, '--', ...args]) !== 0) {
      log(
        `! "npm run ${script}" failed; skipping Search inside PDFs. Run it by hand to see why.`,
      );
      return false;
    }
  }
  if (!hasIndex()) return false;
  log(
    '  Done. This index has only the English books; for the Burmese pilot books too, run the pilot with Tesseract (docs/book-search.md).',
  );
  return true;
}
