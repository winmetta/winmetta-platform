import { resolveInput } from '@winmetta/myanmar-input';
import { convert } from '@winmetta/myanmar-convert';
import { describe, expect, it } from 'vitest';
import { LookupError, MAX_QUERY_CHARS, parseLookupResponse } from './contract';
import { lookup, route, scenarioFromSearch, type Backend } from './client';
import * as events from './events';
import { sources, words } from './fixtures';
import { headwordKey } from './key';
import { mockLookup } from './mock';
import { EXAMPLES, asZawgyi, exampleRaw, otherReading } from './readings';
import { initialState, reduce, showFilter, visibleGroups } from './state';

const fast = { delayMs: 0 };
const ask = async (q: string, extra: object = {}) =>
  parseLookupResponse(await mockLookup({ q, ...extra }, fast));

describe('the mock and the contract', () => {
  it('answers like the real service and parses with the same parser', async () => {
    const response = await ask('ဓမ္မ');
    expect(response).toMatchObject({
      v: 1,
      via: 'mock',
      mock: true,
      matchKind: 'exact',
    });
    expect(response.groups[0]?.entries.map((e) => e.sourceId)).toEqual([
      'sample-a',
      'sample-b',
      'sample-c',
    ]);
    expect(response.sources).toHaveLength(3);
    expect(response.related).toEqual(['ဓမ္မပဒ', 'ဓမ္မစက္က']);
  });

  it('finds loose, prefix and no matches', async () => {
    expect(await ask('ဓမမ')).toMatchObject({ matchKind: 'loose' });
    const prefix = await ask('ဓမ္မစ');
    expect(prefix).toMatchObject({ matchKind: 'prefix' });
    expect(prefix.groups.map((g) => g.headword)).toEqual(['ဓမ္မစက္က']);
    expect(await ask('ဘောဇ')).toMatchObject({ matchKind: 'none', groups: [] });
  });

  it('does not offer prefix matches for a single syllable', async () => {
    expect((await ask('ဓ')).matchKind).toBe('none');
  });

  it('filters by source and keeps dictionaries apart', async () => {
    const response = await ask('ဓမ္မ', { sources: ['sample-b'] });
    expect(response.groups[0]?.entries).toHaveLength(1);
    expect(response.sources.map((s) => s.sourceId)).toEqual(['sample-b']);
  });

  it('rejects an answer that is not the contract', () => {
    for (const bad of [null, {}, { v: 2 }, { v: 1, groups: 'x' }])
      expect(() => parseLookupResponse(bad)).toThrow(LookupError);
  });

  it('has fixtures without HTML or Zawgyi, one OCR row and the placeholder sources', () => {
    const everything = JSON.stringify([words, sources]);
    expect(everything).not.toMatch(/<[a-z/][^>]*>/i);
    for (const word of words) {
      expect(word.headword).toBe(word.headword.normalize('NFC'));
      expect(headwordKey(word.headword)).not.toBe('');
      expect(convert(word.headword, 'unicode', 'unicode').text).toBe(
        word.headword,
      );
    }
    expect(words.length).toBe(12);
    expect(words.some((w) => w.entries.some((e) => e.quality === 'ocr'))).toBe(
      true,
    );
  });
});

describe('the client', () => {
  const ok: Backend = (r) => mockLookup(r, fast);
  const empty: Backend = (r) => mockLookup({ ...r, q: 'ဘောဇ' }, fast);
  const broken: Backend = () => Promise.reject(new Error('down'));

  it('uses the first answer with entries', async () => {
    const response = await route([empty, ok], { q: 'ဓမ္မ' });
    expect(response.groups.length).toBeGreaterThan(0);
  });

  it('falls back when a backend fails or finds nothing', async () => {
    expect((await route([broken, ok], { q: 'ဓမ္မ' })).matchKind).toBe('exact');
    expect((await route([empty], { q: 'ဓမ္မ' })).matchKind).toBe('none');
  });

  it('throws the last failure when nothing answers', async () => {
    await expect(route([broken], { q: 'ဓမ္မ' })).rejects.toMatchObject({
      kind: 'error',
    });
  });

  it('refuses a dataset built with another key version', async () => {
    const mismatch: Backend = (r) =>
      mockLookup(r, { ...fast, scenario: 'key-mismatch' });
    await expect(route([mismatch], { q: 'ဓမ္မ' })).rejects.toMatchObject({
      kind: 'key-mismatch',
    });
  });

  it('refuses a query that is too long before asking anyone', async () => {
    let asked = false;
    const spy: Backend = (r) => ((asked = true), ok(r));
    await expect(
      lookup({ q: 'ဓ'.repeat(MAX_QUERY_CHARS + 1) }, [spy]),
    ).rejects.toMatchObject({ kind: 'too-long' });
    expect(asked).toBe(false);
    await expect(lookup({ q: 'ဓမ္မ' }, [ok])).resolves.toBeTruthy();
  });

  it('reads the mock scenario only where a build allows it', () => {
    expect(scenarioFromSearch('?mock=error', true)).toBe('error');
    expect(scenarioFromSearch('?mock=error', false)).toBe('ok');
    expect(scenarioFromSearch('?mock=nonsense', true)).toBe('ok');
    expect(scenarioFromSearch('', true)).toBe('ok');
  });

  it('a failing mock scenario throws', async () => {
    await expect(
      mockLookup({ q: 'ဓမ္မ' }, { ...fast, scenario: 'error' }),
    ).rejects.toThrow();
  });
});

describe('state', () => {
  it('keeps earlier results while loading and after a failure', async () => {
    const response = await ask('ဓမ္မ');
    let state = reduce(initialState, { type: 'start', query: 'ဓမ္မ' });
    expect(state.phase).toBe('loading');
    state = reduce(state, { type: 'success', response });
    expect(state.phase).toBe('found');
    state = reduce(state, { type: 'start', query: 'သတ္တ' });
    expect(state).toMatchObject({ phase: 'loading', response });
    state = reduce(state, { type: 'failure', kind: 'error' });
    expect(state).toMatchObject({ phase: 'error', issue: 'error', response });
    state = reduce(state, { type: 'failure', kind: 'too-long' });
    expect(state.phase).toBe('too-long');
  });

  it('shows no result with the other reading offered, and clears', async () => {
    const none = await ask('ဘောဇ');
    const alternate = { query: 'ဓမ္မ', response: await ask('ဓမ္မ') };
    let state = reduce(initialState, {
      type: 'success',
      response: none,
      alternate,
    });
    expect(state).toMatchObject({ phase: 'none', alternate });
    state = reduce(state, {
      type: 'success',
      response: await ask('ဓမ္မ'),
      alternate,
    });
    expect(state).toMatchObject({ phase: 'found', alternate: null });
    expect(reduce(state, { type: 'clear' })).toEqual(initialState);
  });

  it('filters by dictionary and offers the filter only above three', async () => {
    const response = await ask('ဓမ္မ');
    let state = reduce(initialState, { type: 'success', response });
    state = reduce(state, { type: 'filter', sourceId: 'sample-c' });
    expect(visibleGroups(state)[0]?.entries.map((e) => e.sourceId)).toEqual([
      'sample-c',
    ]);
    expect(showFilter(response)).toBe(false);
    expect(
      showFilter({
        ...response,
        sources: [...response.sources, ...response.sources],
      }),
    ).toBe(true);
    // A new answer resets the filter.
    expect(reduce(state, { type: 'success', response }).filter).toBeNull();
  });
});

describe('readings', () => {
  const resolve = (raw: string, method: 'auto' | 'unicode' | 'win-innwa') =>
    resolveInput(raw, { method });

  it('gives Win Innwa typists glyph codes for the examples', () => {
    expect(exampleRaw('ဓမ္မ', 'win-innwa')).toBe('"r®');
    expect(exampleRaw('ဓမ္မ', 'auto')).toBe('ဓမ္မ');
    expect(EXAMPLES).toHaveLength(3);
  });

  it('offers the other reading in Auto', () => {
    // Unicode that Auto kept: the Zawgyi reading is the other one, when it differs.
    const zawgyiTyped = convert('မြန်မာ', 'unicode', 'zawgyi').text;
    expect(otherReading('ဓမ္မ', 'auto', resolve('ဓမ္မ', 'auto'))).toBe(
      asZawgyi('ဓမ္မ'),
    );
    // Zawgyi that Auto converted: the other reading is the text as Unicode.
    const converted = resolve(zawgyiTyped, 'auto');
    expect(converted.source).toBe('zawgyi');
    expect(otherReading(zawgyiTyped, 'auto', converted)).not.toBe(
      converted.unicode,
    );
  });

  it('has no other reading in Win Innwa, or when both readings agree', () => {
    expect(
      otherReading('"r®', 'win-innwa', resolve('"r®', 'win-innwa')),
    ).toBeNull();
    expect(
      otherReading('abc', 'unicode', resolve('abc', 'unicode')),
    ).toBeNull();
  });
});

describe('events', () => {
  const response = {
    matchKind: 'loose' as const,
    via: 'mock' as const,
    sources,
  };

  it('buckets lengths and result counts at the boundaries', () => {
    const lengths: [number, string][] = [
      [1, '1-5'],
      [5, '1-5'],
      [6, '6-15'],
      [15, '6-15'],
      [16, '16+'],
      [64, '16+'],
    ];
    for (const [n, bucket] of lengths)
      expect(events.bucketQueryLength(n)).toBe(bucket);
    const counts: [number, string][] = [
      [0, '0'],
      [1, '1'],
      [2, '2-3'],
      [3, '2-3'],
      [4, '4+'],
    ];
    for (const [n, bucket] of counts)
      expect(events.bucketResults(n)).toBe(bucket);
  });

  it('carry only fixed words and buckets, never the word or its sources', () => {
    const event = events.lookup('win-innwa', 4, response);
    expect(event).toEqual({
      name: 'pali_lookup',
      data: {
        method: 'win-innwa',
        length: '1-5',
        match: 'loose',
        results: '2-3',
        via: 'mock',
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/sample|ဓ/);
    expect(events.retry('search-as-zawgyi').data).toEqual({
      kind: 'search-as-zawgyi',
    });
    expect(events.filter('one').data).toEqual({ scope: 'one' });
    expect(events.issue('key-mismatch').data).toEqual({ kind: 'key-mismatch' });
    for (const e of [events.example(), events.related(), events.share()])
      expect(e.data).toEqual({});
  });
});
