import { describe, expect, it } from 'vitest';
import { TARGET, evaluate, loadGolden, type GoldenQuery } from './golden.ts';

const q = (
  text: string,
  book: string,
  page: number,
  language = 'en',
): GoldenQuery => ({ q: text, book, page, language });

describe('evaluate', () => {
  it('ranks the expected page within the first five results and counts by language', async () => {
    const results: Record<string, { bookId: string; page: number }[]> = {
      a: [{ bookId: 'b1', page: 3 }],
      b: [
        { bookId: 'b9', page: 1 },
        { bookId: 'b1', page: 7 },
      ],
      c: [1, 2, 3, 4, 5, 6].map((page) => ({ bookId: 'b1', page })),
      d: [],
    };
    const report = await evaluate(
      [
        q('a', 'b1', 3),
        q('b', 'b1', 7, 'my'),
        q('c', 'b1', 6),
        q('d', 'b1', 1, 'my'),
      ],
      async (text) => results[text] ?? [],
    );
    expect(report.outcomes.map((o) => o.rank)).toEqual([
      1,
      2,
      undefined,
      undefined,
    ]);
    expect(report).toMatchObject({ total: 4, hits: 2, rate: 0.5 });
    expect(report.byLanguage).toEqual({
      en: { total: 2, hits: 1 },
      my: { total: 2, hits: 1 },
    });
  });
  it('counts a book match on another page as a miss', async () => {
    const report = await evaluate([q('a', 'b1', 3)], async () => [
      { bookId: 'b1', page: 4 },
    ]);
    expect(report.hits).toBe(0);
  });
  it('records a failing search as a miss with its error and keeps going', async () => {
    const report = await evaluate(
      [q('x', 'b1', 1), q('y', 'b1', 1)],
      async (text) => {
        if (text === 'x') throw new Error('network down');
        return [{ bookId: 'b1', page: 1 }];
      },
    );
    expect(report.outcomes[0]).toMatchObject({
      rank: undefined,
      error: 'network down',
    });
    expect(report.hits).toBe(1);
  });
  it('is zero for no queries and has a 90% target', async () => {
    expect((await evaluate([], async () => [])).rate).toBe(0);
    expect(TARGET).toBe(0.9);
  });
});

describe('the committed pilot files', () => {
  it('list queries that name a pilot book, in both languages', async () => {
    const queries = await loadGolden(
      new URL('../pilot/golden-queries.json', import.meta.url).pathname,
    );
    const books = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(new URL('../pilot/books.json', import.meta.url), 'utf8'),
    ).books as { id: string }[];
    const ids = new Set(books.map((b) => b.id));
    expect(queries.length).toBeGreaterThanOrEqual(15);
    expect(queries.every((x) => ids.has(x.book))).toBe(true);
    expect(new Set(queries.map((x) => x.language))).toEqual(
      new Set(['my', 'en']),
    );
  });
});
