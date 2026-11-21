import {
  errorResponseSchema,
  healthResponseSchema,
  searchResponseSchema,
  type HealthResponse,
  type SearchParams,
  type SearchResponse,
} from './contract.ts';

export class SearchApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`Search API error ${status}: ${code}`);
    this.status = status;
    this.code = code;
  }
}

export interface SearchClient {
  search(params: SearchParams): Promise<SearchResponse>;
  health(): Promise<HealthResponse>;
}

/**
 * A client for the book-search API. Only the base URL says where the service is (the local
 * server, or https://app.winmetta.org); nothing else in it is specific to either.
 */
export function createSearchClient(options: {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): SearchClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15000;

  async function get<T>(
    path: string,
    params: URLSearchParams,
    parse: (body: unknown) => T,
  ): Promise<T> {
    const query = params.toString();
    const response = await doFetch(
      `${base}${path}${query ? `?${query}` : ''}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new SearchApiError(response.status, 'invalid_response');
    }
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(body);
      throw new SearchApiError(
        response.status,
        parsed.success ? parsed.data.error.code : 'unknown_error',
      );
    }
    return parse(body);
  }

  return {
    search(params) {
      const query = new URLSearchParams({ q: params.q });
      if (params.lang) query.set('lang', params.lang);
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.page !== undefined) query.set('page', String(params.page));
      return get('/api/search', query, (body) =>
        searchResponseSchema.parse(body),
      );
    },
    health() {
      return get('/api/search/health', new URLSearchParams(), (body) =>
        healthResponseSchema.parse(body),
      );
    },
  };
}
