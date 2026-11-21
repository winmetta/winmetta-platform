import type { ErrorCode } from '../contract.ts';
import { QueryError, parseQuery } from './query.ts';
import { health, search, type OpenedIndex } from './search.ts';

export interface ApiRequest {
  method: string;
  /** Path and query, as in `/api/search?q=abc`. */
  url: string;
  /** Lower-case header names. */
  headers: Record<string, string | undefined>;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiContext {
  /** Undefined when no index could be loaded: every search answers 503. */
  index: OpenedIndex | undefined;
  cdnBase: string;
}

const json = (
  status: number,
  body: unknown,
  cacheable = false,
): ApiResponse => ({
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheable ? 'public, max-age=300' : 'no-store',
    'x-content-type-options': 'nosniff',
  },
  body,
});

const failure = (status: number, code: ErrorCode): ApiResponse =>
  json(status, { v: 1, error: { code } });

/**
 * The whole API as one function of a request, so the local server and the AWS Lambda share it
 * and tests need no network. A request marked cross-site by the browser is refused, as the
 * production route is for pages of app.winmetta.org only.
 */
export function handleRequest(
  request: ApiRequest,
  context: ApiContext,
): ApiResponse {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname !== '/api/search' && url.pathname !== '/api/search/health')
    return failure(404, 'not_found');
  if (request.method !== 'GET') return failure(405, 'method_not_allowed');
  if (request.headers['sec-fetch-site'] === 'cross-site')
    return failure(403, 'forbidden_origin');
  if (!context.index) return failure(503, 'index_unavailable');
  try {
    if (url.pathname === '/api/search/health')
      return json(200, health(context.index));
    const query = parseQuery(url.searchParams);
    return json(200, search(context.index, query, context.cdnBase), true);
  } catch (error) {
    if (error instanceof QueryError) return failure(400, error.code);
    // Any other failure (for example a SQLite error) is a generic 500: no detail, no query.
    return failure(500, 'internal_error');
  }
}
