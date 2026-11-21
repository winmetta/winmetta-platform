import { z } from 'zod';

// The book-search API contract (docs/book-search.md §7). The local server and the AWS backend
// both implement it; the client validates every response against it.

export const LANGUAGES = ['any', 'my', 'en', 'pi', 'und'] as const;
export type SearchLanguage = (typeof LANGUAGES)[number];

export const MAX_QUERY_CHARS = 200;
export const MAX_TERMS = 8;
export const MAX_LIMIT = 20;
export const DEFAULT_LIMIT = 10;
export const MAX_PAGE = 10;

export const ERROR_CODES = [
  'query_missing',
  'query_too_short',
  'query_too_long',
  'too_many_terms',
  'bad_param',
  'forbidden_origin',
  'not_found',
  'method_not_allowed',
  'index_unavailable',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const searchResultSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  language: z.string(),
  /** Physical PDF page, 1-based; it can differ from the printed page number. */
  page: z.number().int().min(1),
  snippet: z.string(),
  /** True when the page text came from OCR rather than the PDF's own text layer. */
  ocr: z.boolean(),
  confidence: z.number().min(0).max(1).nullable(),
  /** The PDF address with `#page=N`. */
  pdfUrl: z.string(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  v: z.literal(1),
  indexVersion: z.string(),
  query: z.object({
    q: z.string(),
    lang: z.enum(LANGUAGES),
    limit: z.number().int(),
    page: z.number().int(),
  }),
  hasMore: z.boolean(),
  results: z.array(searchResultSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const healthResponseSchema = z.object({
  v: z.literal(1),
  indexVersion: z.string(),
  books: z.number().int(),
  pages: z.number().int(),
  passages: z.number().int(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const errorResponseSchema = z.object({
  v: z.literal(1),
  error: z.object({ code: z.enum(ERROR_CODES) }),
});

export interface SearchParams {
  q: string;
  lang?: SearchLanguage;
  limit?: number;
  page?: number;
}
