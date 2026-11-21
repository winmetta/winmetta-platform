import { ftsTokens } from '@winmetta/search-text';
import {
  DEFAULT_LIMIT,
  LANGUAGES,
  MAX_LIMIT,
  MAX_PAGE,
  MAX_QUERY_CHARS,
  MAX_TERMS,
  type ErrorCode,
  type SearchLanguage,
} from '../contract.ts';

export class QueryError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface ParsedQuery {
  q: string;
  lang: SearchLanguage;
  limit: number;
  page: number;
  /** FTS5 expression built only from quoted tokens. */
  match: string;
  /** The words the user typed, for locating a snippet. */
  words: string[];
}

const ALLOWED = new Set(['q', 'lang', 'limit', 'page']);

/** A term is a word or a quoted phrase; quotes group words, nothing else is syntax. */
export function splitTerms(q: string): string[] {
  const terms: string[] = [];
  for (const match of q.matchAll(/"([^"]*)"|([^\s"]+)/g))
    terms.push((match[1] ?? match[2] ?? '').trim());
  return terms.filter(Boolean);
}

const integer = (
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (value === null) return fallback;
  if (!/^\d{1,4}$/.test(value)) throw new QueryError('bad_param');
  const n = Number(value);
  if (n < min || n > max) throw new QueryError('bad_param');
  return n;
};

/** FTS5 string literal: every token is quoted, so FTS syntax in user text is only text. */
const quote = (tokens: string[]): string =>
  `"${tokens.join(' ').replace(/"/g, '""')}"`;

/** A Burmese term needs two syllables or three characters, so a single letter cannot match a library. */
const burmeseTooShort = (syllables: string[]): boolean =>
  syllables.length === 1 && [...(syllables[0] ?? '')].length < 3;

export function parseQuery(params: URLSearchParams): ParsedQuery {
  for (const key of params.keys())
    if (!ALLOWED.has(key)) throw new QueryError('bad_param');
  for (const key of ALLOWED)
    if (params.getAll(key).length > 1) throw new QueryError('bad_param');
  const q = params.get('q');
  if (q === null || q.trim() === '') throw new QueryError('query_missing');
  if ([...q].length > MAX_QUERY_CHARS) throw new QueryError('query_too_long');
  const lang = params.get('lang') ?? 'any';
  if (!(LANGUAGES as readonly string[]).includes(lang))
    throw new QueryError('bad_param');
  const limit = integer(params.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const page = integer(params.get('page'), 1, 1, MAX_PAGE);

  const terms = splitTerms(q);
  if (terms.length > MAX_TERMS) throw new QueryError('too_many_terms');
  const clauses: string[] = [];
  for (const term of terms) {
    const tokens = ftsTokens(term);
    if (tokens.my.length > 0) {
      if (burmeseTooShort(tokens.my)) throw new QueryError('query_too_short');
      clauses.push(`my_tokens:${quote(tokens.my)}`);
    }
    if (tokens.latin.length > 0)
      clauses.push(`latin_tokens:${quote(tokens.latin)}`);
  }
  if (clauses.length === 0) throw new QueryError('query_too_short');
  return {
    q,
    lang: lang as SearchLanguage,
    limit,
    page,
    match: clauses.join(' AND '),
    words: terms,
  };
}
