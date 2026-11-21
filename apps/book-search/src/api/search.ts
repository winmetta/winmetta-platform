import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileUrl } from '../../../web/src/lib/library-index.ts';
import type {
  HealthResponse,
  SearchResponse,
  SearchResult,
} from '../contract.ts';
import { SCHEMA_VERSION } from '../schema.ts';
import type { ParsedQuery } from './query.ts';

export const SNIPPET_CHARS = 200;

/** A window of the passage around the first typed word that appears in it, else its start. */
export function makeSnippet(text: string, words: string[]): string {
  const chars = [...text.normalize('NFC')];
  const flat = chars.join('');
  const lower = flat.toLowerCase();
  let at = -1;
  for (const word of words) {
    at = lower.indexOf(word.normalize('NFC').toLowerCase());
    if (at >= 0) break;
  }
  const start = at < 0 ? 0 : [...flat.slice(0, at)].length;
  const from = Math.max(0, start - Math.floor(SNIPPET_CHARS / 4));
  const to = Math.min(chars.length, from + SNIPPET_CHARS);
  return `${from > 0 ? '… ' : ''}${chars.slice(from, to).join('').trim()}${to < chars.length ? ' …' : ''}`;
}

export interface OpenedIndex {
  db: DatabaseSync;
  indexVersion: string;
}

/** Opens a built index read-only; refuses a file made with another schema version. */
export function openIndex(
  file: string,
  options: { verifySha?: boolean } = {},
): OpenedIndex {
  if (options.verifySha) {
    const shaFile = `${file}.sha256`;
    if (!existsSync(shaFile)) throw new Error(`${shaFile} is missing`);
    const expected = readFileSync(shaFile, 'utf8').split(/\s+/)[0];
    const actual = createHash('sha256')
      .update(readFileSync(file))
      .digest('hex');
    if (expected !== actual)
      throw new Error(`${file} does not match its .sha256`);
  }
  const db = new DatabaseSync(file, { readOnly: true });
  const meta = (key: string): string | undefined =>
    (
      db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
        { value: string } | undefined
    )?.value;
  if (meta('schema_version') !== String(SCHEMA_VERSION)) {
    db.close();
    throw new Error(
      `${file} has schema version ${meta('schema_version')}, expected ${SCHEMA_VERSION}`,
    );
  }
  return { db, indexVersion: meta('index_version') ?? 'unknown' };
}

export function health(index: OpenedIndex): HealthResponse {
  const n = (sql: string): number =>
    Number(Object.values(index.db.prepare(sql).get() ?? {})[0]);
  return {
    v: 1,
    indexVersion: index.indexVersion,
    books: n('SELECT count(*) FROM books'),
    pages: n('SELECT count(*) FROM pages'),
    passages: n('SELECT count(*) FROM passages'),
  };
}

interface Row {
  book_id: string;
  title: string;
  key: string;
  language: string;
  page: number;
  display_text: string;
  method: string;
  confidence: number | null;
}

const SEARCH_SQL = `
WITH hits AS (
  SELECT p.id, p.book_id, p.page, p.display_text, bm25(passages_fts) AS score
  FROM passages_fts
  JOIN passages p ON p.id = passages_fts.rowid
  WHERE passages_fts MATCH ?1 AND (?2 = 'any' OR p.language = ?2)
),
best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY book_id, page ORDER BY score, id) AS rn
  FROM hits
)
SELECT b.id AS book_id, b.title, b.key, b.language, best.page, best.display_text,
       pg.method, pg.confidence
FROM best
JOIN books b ON b.id = best.book_id
JOIN pages pg ON pg.book_id = best.book_id AND pg.page = best.page
WHERE best.rn = 1
ORDER BY best.score, b.id, best.page
LIMIT ?3 OFFSET ?4
`;

/** One result per page (its best passage), ranked by bm25, with a page of results and `hasMore`. */
export function search(
  index: OpenedIndex,
  query: ParsedQuery,
  cdnBase: string,
): SearchResponse {
  const rows = index.db
    .prepare(SEARCH_SQL)
    .all(
      query.match,
      query.lang,
      query.limit + 1,
      (query.page - 1) * query.limit,
    ) as unknown as Row[];
  const results: SearchResult[] = rows.slice(0, query.limit).map((row) => ({
    bookId: row.book_id,
    title: row.title,
    language: row.language,
    page: row.page,
    snippet: makeSnippet(row.display_text, query.words),
    ocr: row.method === 'ocr',
    confidence: row.confidence,
    pdfUrl: `${fileUrl(cdnBase, row.key)}#page=${row.page}`,
  }));
  return {
    v: 1,
    indexVersion: index.indexVersion,
    query: {
      q: query.q,
      lang: query.lang,
      limit: query.limit,
      page: query.page,
    },
    hasMore: rows.length > query.limit,
    results,
  };
}
