import { describe, expect, it } from 'vitest';
import {
  citation,
  failureKind,
  parseResponse,
  readPdfQuery,
  searchUrl,
  writePdfQuery,
} from './book-search';

const hit = {
  bookId: 'a1',
  title: 'ဓမ္မ စာအုပ်',
  language: 'my',
  page: 12,
  snippet: '… ဓမ္မ …',
  ocr: true,
  confidence: 0.82,
  pdfUrl: 'https://cdn.example/x.pdf#page=12',
};

describe('parseResponse', () => {
  it('reads the results the page uses', () => {
    expect(parseResponse({ v: 1, hasMore: true, results: [hit] })).toEqual({
      hasMore: true,
      results: [hit],
    });
  });
  it('treats a missing confidence as null and hasMore as false', () => {
    const rest: Partial<typeof hit> = { ...hit };
    delete rest.confidence;
    expect(parseResponse({ v: 1, results: [rest] })).toEqual({
      hasMore: false,
      results: [{ ...rest, confidence: null }],
    });
  });
  it('rejects an answer that is not the contract', () => {
    expect(() => parseResponse(null)).toThrow();
    expect(() => parseResponse({ v: 2, results: [] })).toThrow();
    expect(() => parseResponse({ v: 1 })).toThrow();
    expect(() =>
      parseResponse({ v: 1, results: [{ ...hit, page: '12' }] }),
    ).toThrow();
    expect(() =>
      parseResponse({ v: 1, results: [{ ...hit, pdfUrl: 3 }] }),
    ).toThrow();
  });
});

describe('searchUrl', () => {
  it('encodes the query and asks for ten results, adding the page after the first', () => {
    expect(searchUrl('ဓမ္မ ဒေသနာ')).toBe(
      `/api/search?q=${encodeURIComponent('ဓမ္မ ဒေသနာ')}&limit=10`,
    );
    expect(searchUrl('a "b c"', 3)).toBe(
      `/api/search?q=${encodeURIComponent('a "b c"')}&limit=10&page=3`,
    );
  });
});

describe('the pdf query in the page address', () => {
  const where = { pathname: '/en/dhamma-library/', hash: '#top' };
  it('reads and writes it, keeping other parameters and the fragment', () => {
    expect(readPdfQuery('?q=title&pdf=noble+truths')).toBe('noble truths');
    expect(readPdfQuery('?q=title')).toBe('');
    expect(
      writePdfQuery('noble truths', { ...where, search: '?q=title&tag=x' }),
    ).toBe('/en/dhamma-library/?q=title&tag=x&pdf=noble+truths#top');
  });
  it('removes it for an empty query', () => {
    expect(writePdfQuery('  ', { ...where, search: '?pdf=a&q=b' })).toBe(
      '/en/dhamma-library/?q=b#top',
    );
    expect(writePdfQuery('', { ...where, search: '?pdf=a' })).toBe(
      '/en/dhamma-library/#top',
    );
  });
});

describe('citation', () => {
  it('names the title, the physical PDF page and the page link', () => {
    expect(citation(hit, 'PDF page 12')).toBe(
      'ဓမ္မ စာအုပ်, PDF page 12, https://cdn.example/x.pdf#page=12',
    );
  });
});

describe('failureKind', () => {
  it('asks for a longer query only for short or missing queries', () => {
    expect(failureKind(400, 'query_too_short')).toBe('too_short');
    expect(failureKind(400, 'query_missing')).toBe('too_short');
    expect(failureKind(400, 'bad_param')).toBe('unavailable');
    expect(failureKind(503, 'index_unavailable')).toBe('unavailable');
    expect(failureKind(0, undefined)).toBe('unavailable');
  });
});
