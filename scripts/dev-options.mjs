// Options and environment of `npm run dev` / `just dev`, kept apart from dev.mjs so they can be
// tested without starting anything.

/** The feedback stub's port, and the book-search stub's (each can be changed by an environment variable). */
export const FEEDBACK_PORT = 4322;
export const BOOK_SEARCH_PORT = 4323;

/**
 * Splits the arguments into the two switches this script owns and the rest, which go to
 * the Astro dev server unchanged (`--force`, `--port`, ...).
 */
export function parseDevArgs(args) {
  return {
    feedback: !args.includes('--no-feedback'),
    bookSearch: !args.includes('--no-book-search'),
    rest: args.filter(
      (arg) => arg !== '--no-feedback' && arg !== '--no-book-search',
    ),
  };
}

/**
 * The environment the dev server runs with. Each feature is switched explicitly in both
 * directions, so a stale `.env.local` cannot turn on one that was asked to be off.
 * `hasIndex` says whether a built book-search index exists to serve. The Dāna page needs no
 * stand-in, so it is always linked locally, to show how it looks once PUBLIC_DONATE is on.
 */
export function devEnv({ feedback, bookSearch, hasIndex, ports }) {
  const searchOn = bookSearch && hasIndex;
  return {
    PUBLIC_FEEDBACK: String(feedback),
    PUBLIC_FEEDBACK_POSTS_REVIEWED: String(feedback),
    FEEDBACK_STUB_URL: feedback ? `http://127.0.0.1:${ports.feedback}` : '',
    PUBLIC_BOOK_SEARCH: String(searchOn),
    BOOK_SEARCH_STUB_URL: searchOn
      ? `http://127.0.0.1:${ports.bookSearch}`
      : '',
    PUBLIC_DONATE: 'true',
  };
}
