import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { createSearchClient } from './client.ts';
import { DEFAULT_BASE_URL } from './config.ts';

const goldenSchema = z.object({
  queries: z.array(
    z.object({
      q: z.string().min(1),
      book: z.string().min(1),
      page: z.number().int().min(1),
      language: z.string().min(1),
    }),
  ),
});
export type GoldenQuery = z.infer<typeof goldenSchema>['queries'][number];

/** Where the expected book and page must rank: within the first five results (plan §5C step 6). */
export const TOP = 5;
/** The pilot's target share of queries that find their page in the first five results. */
export const TARGET = 0.9;

export interface Found {
  bookId: string;
  page: number;
}
export interface Outcome {
  query: GoldenQuery;
  /** 1-based rank of the expected page, or undefined when it is not in the first five. */
  rank: number | undefined;
  error?: string;
}
export interface Report {
  total: number;
  hits: number;
  rate: number;
  byLanguage: Record<string, { total: number; hits: number }>;
  outcomes: Outcome[];
}

/** Runs every query through `search` and ranks the expected page. */
export async function evaluate(
  queries: GoldenQuery[],
  search: (q: string) => Promise<Found[]>,
): Promise<Report> {
  const outcomes: Outcome[] = [];
  for (const query of queries) {
    try {
      const found = (await search(query.q)).slice(0, TOP);
      const index = found.findIndex(
        (hit) => hit.bookId === query.book && hit.page === query.page,
      );
      outcomes.push({ query, rank: index < 0 ? undefined : index + 1 });
    } catch (error) {
      outcomes.push({
        query,
        rank: undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const byLanguage: Report['byLanguage'] = {};
  for (const { query, rank } of outcomes) {
    const entry = (byLanguage[query.language] ??= { total: 0, hits: 0 });
    entry.total += 1;
    if (rank !== undefined) entry.hits += 1;
  }
  const hits = outcomes.filter((o) => o.rank !== undefined).length;
  return {
    total: outcomes.length,
    hits,
    rate: outcomes.length ? hits / outcomes.length : 0,
    byLanguage,
    outcomes,
  };
}

export async function loadGolden(file: string): Promise<GoldenQuery[]> {
  return goldenSchema.parse(JSON.parse(await readFile(file, 'utf8'))).queries;
}

const defaultFile = new URL('../pilot/golden-queries.json', import.meta.url)
  .pathname;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { file: { type: 'string' }, 'base-url': { type: 'string' } },
  });
  const client = createSearchClient({
    baseUrl:
      values['base-url'] ??
      process.env['BOOK_SEARCH_BASE_URL'] ??
      DEFAULT_BASE_URL,
  });
  const report = await evaluate(
    await loadGolden(values.file ?? defaultFile),
    async (q) => (await client.search({ q, limit: TOP })).results,
  );
  for (const { query, rank, error } of report.outcomes)
    console.log(
      `${rank ? `#${rank}` : 'MISS'}\t${query.language}\t${query.q}\t(expected ${query.book} p.${query.page})${error ? ` ${error}` : ''}`,
    );
  for (const [language, { total, hits }] of Object.entries(report.byLanguage))
    console.log(`${language}: ${hits}/${total}`);
  console.log(
    `Found in the first ${TOP}: ${report.hits}/${report.total} (${Math.round(report.rate * 100)}%), target ${Math.round(TARGET * 100)}%`,
  );
  return report.rate >= TARGET ? 0 : 2;
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
