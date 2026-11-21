// Search inside PDFs: the client side of the same-origin /api/search service
// (docs/book-search.md §7 and §13). Pure helpers, shared by the island and its tests.

/** Off unless the build sets PUBLIC_BOOK_SEARCH=true; also the kill switch for the page. */
export const bookSearchEnabled = import.meta.env.PUBLIC_BOOK_SEARCH === 'true';

export const SEARCH_PARAM = 'pdf';
export const PAGE_SIZE = 10;

export interface BookHit {
  bookId: string;
  title: string;
  language: string;
  page: number;
  snippet: string;
  ocr: boolean;
  confidence: number | null;
  pdfUrl: string;
}
export interface BookSearchResponse {
  hasMore: boolean;
  results: BookHit[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Checks only what the page uses, so an unexpected answer is an error and not a broken page. */
export function parseResponse(body: unknown): BookSearchResponse {
  if (!isRecord(body) || body['v'] !== 1 || !Array.isArray(body['results']))
    throw new Error('unexpected search response');
  const results = body['results'].map((item): BookHit => {
    if (
      !isRecord(item) ||
      typeof item['bookId'] !== 'string' ||
      typeof item['title'] !== 'string' ||
      typeof item['language'] !== 'string' ||
      typeof item['page'] !== 'number' ||
      typeof item['snippet'] !== 'string' ||
      typeof item['ocr'] !== 'boolean' ||
      typeof item['pdfUrl'] !== 'string'
    )
      throw new Error('unexpected search result');
    return {
      bookId: item['bookId'],
      title: item['title'],
      language: item['language'],
      page: item['page'],
      snippet: item['snippet'],
      ocr: item['ocr'],
      confidence:
        typeof item['confidence'] === 'number' ? item['confidence'] : null,
      pdfUrl: item['pdfUrl'],
    };
  });
  return { hasMore: body['hasMore'] === true, results };
}

/** The request address for one page of results (limit and page are the API's own parameters). */
export function searchUrl(q: string, page = 1): string {
  return `/api/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}${page > 1 ? `&page=${page}` : ''}`;
}

export function readPdfQuery(search: string): string {
  return new URLSearchParams(search).get(SEARCH_PARAM) ?? '';
}

/** The page address with this search in it, keeping every other parameter and the fragment. */
export function writePdfQuery(
  q: string,
  location: { pathname: string; search: string; hash: string },
): string {
  const params = new URLSearchParams(location.search);
  if (q.trim()) params.set(SEARCH_PARAM, q);
  else params.delete(SEARCH_PARAM);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
}

/** The text Copy citation puts on the clipboard. The page is the physical PDF page. */
export function citation(
  hit: Pick<BookHit, 'title' | 'page' | 'pdfUrl'>,
  pageLabel: string,
): string {
  return `${hit.title}, ${pageLabel}, ${hit.pdfUrl}`;
}

/** What the page shows for an API error code, so the island needs no string matching. */
export type FailureKind = 'too_short' | 'unavailable';
export function failureKind(
  status: number,
  code: string | undefined,
): FailureKind {
  return status === 400 &&
    (code === 'query_too_short' || code === 'query_missing')
    ? 'too_short'
    : 'unavailable';
}
