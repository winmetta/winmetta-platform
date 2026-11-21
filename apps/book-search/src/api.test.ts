import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixtureIndex } from '../test/fixtureIndex.ts';
import {
  handleRequest,
  type ApiContext,
  type ApiResponse,
} from './api/handler.ts';
import { QueryError, parseQuery, splitTerms } from './api/query.ts';
import { makeSnippet, openIndex, type OpenedIndex } from './api/search.ts';
import { errorResponseSchema, searchResponseSchema } from './contract.ts';

const params = (q: Record<string, string>) => new URLSearchParams(q);
const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof QueryError ? error.code : String(error);
  }
  return undefined;
};

describe('splitTerms', () => {
  it('splits words and keeps quoted phrases together', () => {
    expect(splitTerms('noble "eightfold path"  truths')).toEqual([
      'noble',
      'eightfold path',
      'truths',
    ]);
    expect(splitTerms('"unterminated phrase')).toEqual([
      'unterminated',
      'phrase',
    ]);
    expect(splitTerms('  ')).toEqual([]);
  });
});

describe('parseQuery', () => {
  it('applies defaults and builds quoted FTS expressions', () => {
    const q = parseQuery(params({ q: 'noble truths' }));
    expect(q).toMatchObject({ lang: 'any', limit: 10, page: 1 });
    expect(q.match).toBe('latin_tokens:"noble" AND latin_tokens:"truths"');
  });
  it('turns a quoted phrase into one FTS phrase and Burmese into syllables', () => {
    expect(parseQuery(params({ q: '"eightfold path"' })).match).toBe(
      'latin_tokens:"eightfold path"',
    );
    expect(parseQuery(params({ q: 'ဓမ္မ ဒေသနာ' })).match).toBe(
      'my_tokens:"ဓမ္မ" AND my_tokens:"ဒေ သ နာ"',
    );
  });
  it('folds accents and case in Latin terms', () => {
    expect(parseQuery(params({ q: 'Pāḷi' })).match).toBe('latin_tokens:"pali"');
  });
  it('treats FTS5 syntax typed by a user as text, never as an operator', () => {
    for (const q of [
      'dhamma OR sutta',
      'NEAR(a b)',
      'dh*',
      '^dhamma',
      'a" OR "b',
      'title:dhamma',
      '-dhamma',
      '(dhamma)',
    ]) {
      const { match } = parseQuery(params({ q }));
      // Every token sits inside double quotes after a column name; no bare operators remain.
      expect(
        match.replace(/(my|latin)_tokens:"[^"]*"/g, '').replace(/ AND /g, ''),
      ).toBe('');
    }
    expect(parseQuery(params({ q: 'dhamma OR sutta' })).match).toBe(
      'latin_tokens:"dhamma" AND latin_tokens:"or" AND latin_tokens:"sutta"',
    );
  });
  it('rejects bad input with a stable code', () => {
    expect(codeOf(() => parseQuery(params({})))).toBe('query_missing');
    expect(codeOf(() => parseQuery(params({ q: '   ' })))).toBe(
      'query_missing',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x'.repeat(201) })))).toBe(
      'query_too_long',
    );
    expect(codeOf(() => parseQuery(params({ q: 'a b c d e f g h i' })))).toBe(
      'too_many_terms',
    );
    expect(codeOf(() => parseQuery(params({ q: '!!! ???' })))).toBe(
      'query_too_short',
    );
    expect(codeOf(() => parseQuery(params({ q: 'က' })))).toBe(
      'query_too_short',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', lang: 'fr' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', limit: '21' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', limit: '0' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', page: '11' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', page: '1e1' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(params({ q: 'x', extra: '1' })))).toBe(
      'bad_param',
    );
    expect(codeOf(() => parseQuery(new URLSearchParams('q=a&q=b')))).toBe(
      'bad_param',
    );
  });
  it('accepts a one-syllable Burmese word of three characters, such as ဓမ္မ', () => {
    expect(codeOf(() => parseQuery(params({ q: 'ဓမ္မ' })))).toBeUndefined();
  });
});

describe('makeSnippet', () => {
  it('centres on the first typed word found and marks cut ends', () => {
    const text = `${'word '.repeat(60)}needle ${'tail '.repeat(60)}`;
    const snippet = makeSnippet(text, ['needle']);
    expect(snippet).toContain('needle');
    expect(snippet.startsWith('… ')).toBe(true);
    expect(snippet.endsWith(' …')).toBe(true);
    expect([...snippet].length).toBeLessThan(215);
  });
  it('starts at the beginning when no word is found, and keeps short text whole', () => {
    expect(makeSnippet('short text', ['absent'])).toBe('short text');
    expect(makeSnippet('x'.repeat(500), ['y']).startsWith('xxx')).toBe(true);
  });
});

describe('handleRequest on a built index', () => {
  let index: OpenedIndex;
  let context: ApiContext;
  beforeAll(async () => {
    const { file } = await buildFixtureIndex();
    index = openIndex(file, { verifySha: true });
    context = { index, cdnBase: 'https://cdn.example' };
  });
  afterAll(() => index.db.close());

  const get = (
    url: string,
    headers: Record<string, string> = {},
  ): ApiResponse => handleRequest({ method: 'GET', url, headers }, context);
  const ok = (url: string) => {
    const r = get(url);
    expect(r.status).toBe(200);
    return searchResponseSchema.parse(r.body);
  };

  it('finds an English phrase with the page, a snippet and the cited PDF page link', () => {
    const r = ok('/api/search?q=%22noble%20truths%22');
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({
      bookId: 'bbbbbbbbbbbb',
      title: 'Book B',
      page: 1,
      ocr: false,
      confidence: null,
      language: 'en',
    });
    expect(r.results[0]?.snippet).toContain('noble truths');
    expect(r.results[0]?.pdfUrl).toBe(
      'https://cdn.example/en/Book%20B.pdf#page=1',
    );
    expect(r.indexVersion).toBe('2026-11-20-r1');
  });
  it('encodes Burmese keys the way the catalog does', () => {
    const r = ok(`/api/search?q=${encodeURIComponent('သီလ သမာဓိ')}`);
    expect(r.results[0]).toMatchObject({
      bookId: 'aaaaaaaaaaaa',
      page: 2,
      ocr: true,
      confidence: 0.82,
    });
    expect(r.results[0]?.pdfUrl).toBe(
      `https://cdn.example/${encodeURIComponent('ပါဠိတော်')}/Book%20A.pdf#page=2`,
    );
  });
  it('finds Burmese whatever spacing the book used, and unaccented Pāḷi in mixed text', () => {
    expect(
      ok(`/api/search?q=${encodeURIComponent('ဓမ္မ ဒေသနာ')}`).results.map(
        (x) => x.page,
      ),
    ).toEqual([1]);
    expect(
      ok(`/api/search?q=${encodeURIComponent('ဓမ္မဒေသနာ')}`).results.map(
        (x) => x.page,
      ),
    ).toEqual([1]);
    expect(
      ok('/api/search?q=pali').results.map((x) => `${x.bookId}.${x.page}`),
    ).toEqual(['aaaaaaaaaaaa.1']);
    expect(ok('/api/search?q=dhamma').results).toHaveLength(1);
  });
  it('returns one result per page, ranked, and pages through them', () => {
    const all = ok('/api/search?q=truths&limit=1');
    expect(all.hasMore).toBe(true);
    const second = ok('/api/search?q=truths&limit=1&page=2');
    expect(second.hasMore).toBe(false);
    const pages = [...all.results, ...second.results].map(
      (x) => `${x.bookId}.${x.page}`,
    );
    expect(new Set(pages).size).toBe(2);
    expect(ok('/api/search?q=truths&limit=20').results).toHaveLength(2);
  });
  it('filters by passage language', () => {
    expect(ok('/api/search?q=truths&lang=my').results).toHaveLength(0);
    expect(ok('/api/search?q=truths&lang=en').results).toHaveLength(2);
    expect(
      ok(`/api/search?q=${encodeURIComponent('သီလ သမာဓိ')}&lang=en`).results,
    ).toHaveLength(0);
  });
  it('answers with an empty list when nothing matches', () => {
    const r = ok('/api/search?q=nonexistentword');
    expect(r).toMatchObject({ hasMore: false, results: [] });
  });
  it('reports health', () => {
    const r = get('/api/search/health');
    expect(r.body).toEqual({
      v: 1,
      indexVersion: '2026-11-20-r1',
      books: 2,
      pages: 4,
      passages: 6,
    });
  });
  it('answers errors with the contract shape and the right status', () => {
    const expectError = (r: ApiResponse, status: number, code: string) => {
      expect(r.status).toBe(status);
      expect(errorResponseSchema.parse(r.body).error.code).toBe(code);
      expect(r.headers['cache-control']).toBe('no-store');
    };
    expectError(get('/api/search'), 400, 'query_missing');
    expectError(get('/api/search?q=a&bogus=1'), 400, 'bad_param');
    expectError(get('/api/other'), 404, 'not_found');
    expectError(
      handleRequest(
        { method: 'POST', url: '/api/search?q=abc', headers: {} },
        context,
      ),
      405,
      'method_not_allowed',
    );
    expectError(
      get('/api/search?q=abc', { 'sec-fetch-site': 'cross-site' }),
      403,
      'forbidden_origin',
    );
    expectError(
      handleRequest(
        { method: 'GET', url: '/api/search?q=abc', headers: {} },
        { index: undefined, cdnBase: '' },
      ),
      503,
      'index_unavailable',
    );
  });
  it('answers an unexpected failure with a generic 500 instead of throwing', async () => {
    const { file } = await buildFixtureIndex();
    const broken = openIndex(file);
    broken.db.close();
    const context2 = { index: broken, cdnBase: 'https://cdn.example' };
    for (const url of ['/api/search?q=truths', '/api/search/health']) {
      const r = handleRequest({ method: 'GET', url, headers: {} }, context2);
      expect(r.status).toBe(500);
      expect(errorResponseSchema.parse(r.body).error.code).toBe(
        'internal_error',
      );
      expect(JSON.stringify(r.body)).not.toMatch(/truths|sqlite|database/i);
    }
  });
  it('answers a request target the URL parser rejects with 400, not an exception', () => {
    for (const url of ['//[', 'http://[', '//a b:99999999']) {
      const r = handleRequest({ method: 'GET', url, headers: {} }, context);
      expect([400, 404]).toContain(r.status);
    }
    const r = handleRequest(
      { method: 'GET', url: '//[', headers: {} },
      context,
    );
    expect(r.status).toBe(400);
  });
  it('allows same-origin and header-less requests, and sends no CORS headers', () => {
    expect(
      get('/api/search?q=abc', { 'sec-fetch-site': 'same-origin' }).status,
    ).toBe(200);
    const r = get('/api/search?q=abc');
    expect(r.status).toBe(200);
    expect(
      Object.keys(r.headers).filter((h) => h.startsWith('access-control')),
    ).toEqual([]);
  });
  it('does not execute injected FTS syntax', () => {
    expect(ok('/api/search?q=truths%20OR%20nothing').results).toHaveLength(0);
    expect(get('/api/search?q=%22%22%22').status).toBe(400);
  });
});
