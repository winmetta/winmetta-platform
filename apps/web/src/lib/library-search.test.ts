import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fileUrl } from './library-index.ts';
import { LibrarySearch } from './library-search.ts';
import { libraryFileSchema } from './schemas.ts';
// The real committed manifest: these are the golden queries of the Phase 1 plan.
const records = libraryFileSchema
  .array()
  .parse(
    JSON.parse(
      readFileSync(
        new URL('../library/manifest.json', import.meta.url),
        'utf8',
      ),
    ),
  );
const search = LibrarySearch.build(records);
const titles = (hits: { record: { title: string } }[]) =>
  hits.map((hit) => hit.record.title);
describe('library manifest', () => {
  it('has unique ids and keys and every key round-trips into a URL', () => {
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(new Set(records.map((r) => r.key)).size).toBe(records.length);
    for (const record of records)
      expect(() =>
        fileUrl('https://cdn.example.invalid', record.key),
      ).not.toThrow();
  });
});
describe('library search', () => {
  it('finds half-typed Burmese words at syllable starts', () => {
    const { exact } = search.search('ဝိန');
    expect(exact.length).toBeGreaterThan(0);
    expect(exact.every((hit) => hit.tier <= 3)).toBe(true);
    expect(titles(exact).some((title) => title.startsWith('ဝိန'))).toBe(true);
  });
  it('treats spaced and unspaced Burmese queries alike', () => {
    expect(titles(search.search('ဓမ္မ ပဒ').exact)).toContain('ဓမ္မပဒ');
    expect(titles(search.search('ဓမ္မပဒ').exact)).toContain('ဓမ္မပဒ');
  });
  it('ranks an exact title first', () => {
    const { exact } = search.search('ဓမ္မပဒ');
    expect(exact[0]?.tier).toBe(0);
    const tiers = exact.map((hit) => hit.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });
  it('treats ဥ/ဉ and Burmese/ASCII digits as equal', () => {
    expect(search.search('ဥပဒေ').exact.map((h) => h.record.id)).toEqual(
      search.search('ဉပဒေ').exact.map((h) => h.record.id),
    );
    expect(
      search.search('မဟာဗုဒ္ဓဝင် ၁').exact.map((h) => h.record.id),
    ).toEqual(search.search('မဟာဗုဒ္ဓဝင် 1').exact.map((h) => h.record.id));
  });
  it('folds Latin diacritics', () => {
    expect(search.search('Pāḷi').exact.length).toBe(
      search.search('pali').exact.length,
    );
    expect(search.search('pali').exact.length).toBeGreaterThan(0);
  });
  it('recovers from Burmese typos with similar books', () => {
    const typo = search.search('ဓမ္မပဒါ');
    expect(typo.exact).toEqual([]);
    expect(titles(typo.similar.slice(0, 3))).toContain('ဓမ္မပဒ');
    expect(
      titles(search.search('မဟာဗုဒ်ဝင်').similar.slice(0, 6)).join(),
    ).toContain('မဟာဗုဒ္ဓဝင်');
  });
  it('recovers from Latin typos', () => {
    expect(titles(search.search('Abidhamma').similar).join()).toContain(
      'Abhidhamma',
    );
  });
  it('never repeats an exact hit in the similar group', () => {
    const { exact, similar } = search.search('ဝိနည်း');
    const exactIds = new Set(exact.map((hit) => hit.record.id));
    expect(similar.some((hit) => exactIds.has(hit.record.id))).toBe(false);
    expect(similar.every((hit) => hit.similarity >= 0.2)).toBe(true);
  });
  it('filters by tag', () => {
    const { exact } = search.search('ဝိနည်း', { tag: 'ဝိနိစ္ဆယများ' });
    expect(exact.length).toBeGreaterThan(0);
    expect(exact.every((hit) => hit.record.tags.includes('ဝိနိစ္ဆယများ'))).toBe(
      true,
    );
  });
  it('returns nothing for empty or punctuation-only queries', () => {
    expect(search.search('')).toEqual({ exact: [], similar: [] });
    expect(search.search('  ။ ')).toEqual({ exact: [], similar: [] });
  });
  it('gives the same results after serialization', () => {
    const loaded = LibrarySearch.load(records, search.serialize());
    for (const query of ['ဝိနည်း', 'ဓမ္မပဒါ', 'pali']) {
      const ids = (hits: { record: { id: string } }[]) =>
        hits.map((hit) => hit.record.id);
      const a = loaded.search(query);
      const b = search.search(query);
      // Scores can differ in the last floating-point digit after a JSON round trip.
      expect(ids(a.exact)).toEqual(ids(b.exact));
      expect(ids(a.similar)).toEqual(ids(b.similar));
    }
  });
});
describe('prefix matching applies to the last term only', () => {
  const make = (id: string, title: string) => ({
    id,
    key: `${id}.pdf`,
    title,
    tags: [],
    tagPath: [],
    language: 'my',
    sizeBytes: 1,
    format: 'pdf' as const,
    lastModified: '2023-01-01T00:00:00.000Z',
  });
  const small = LibrarySearch.build([
    make('a', 'ဓမ္မပဒ ဋီကာ'),
    make('b', 'ဓမ္မပဒေ ဋီကာ'),
  ]);
  it('does not extend a finished earlier chunk into another word', () => {
    expect(titles(small.search('ဓမ္မပဒ ဋီကာ').exact)).toEqual(['ဓမ္မပဒ ဋီကာ']);
  });
  it('still extends the half-typed last chunk', () => {
    expect(titles(small.search('ဋီကာ ဓမ္မပဒ').exact).sort()).toEqual([
      'ဓမ္မပဒ ဋီကာ',
      'ဓမ္မပဒေ ဋီကာ',
    ]);
  });
});
describe('library search budgets', () => {
  it('keeps the serialized index under 400 KB gzipped', () => {
    expect(gzipSync(search.serialize()).length).toBeLessThan(400 * 1024);
  });
  it('answers queries quickly', () => {
    const queries = ['ဝိနည်း', 'မြန်မာ စာ', 'ဓမ္မပဒါ', 'pali', 'မဟာဗုဒ်ဝင်'];
    const start = performance.now();
    for (let i = 0; i < 20; i++)
      for (const query of queries) search.search(query);
    expect((performance.now() - start) / (20 * queries.length)).toBeLessThan(
      50,
    );
  });
});
