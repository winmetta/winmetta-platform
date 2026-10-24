// Script-aware search terms shared by the Dhamma Library search (library-search.ts) and the
// Dhamma Posts search (posts/search.ts). Text goes through normalizeSearch first, then:
//   Burmese: syllables (burmese.ts), indexed as 1-3 syllable n-grams, so unspaced and
//            half-typed queries match at syllable starts.
//   Chinese: no spaces between words, so every character and every overlapping pair is
//            indexed (贪欲 -> 贪, 欲, 贪欲); a query is its pairs.
//   Other:   whole words (letters and digits).
import type { Query } from 'minisearch';
import { burmeseSyllables, splitScripts } from './burmese.ts';
import { normalizeSearch } from './normalize.ts';

export const MAX_GRAM = 3;
/** Queries are ready-made terms joined by this, never re-tokenized by MiniSearch. */
export const TERM_SEPARATOR = '\u0001';
/** Fuzzy candidates below this character-pair similarity are noise, not "similar". */
export const MIN_SIMILARITY = 0.2;
const myanmarPunctuation = /^[၊-၏]+$/;
const hanRun = /(\p{Script=Han}+)/u;
const isHan = /^\p{Script=Han}/u;

type Unit =
  | { kind: 'my'; syllables: string[] }
  | { kind: 'han'; chars: string[] }
  | { kind: 'word'; text: string };

/** Normalized text as units; Burmese words separated only by spaces are joined. */
function units(text: string): Unit[] {
  const joined = normalizeSearch(text).replace(/([က-႟])\s+(?=[က-႟])/g, '$1');
  const result: Unit[] = [];
  for (const run of splitScripts(joined)) {
    if (run.script === 'my') {
      let current: string[] = [];
      for (const syllable of burmeseSyllables(run.text)) {
        if (myanmarPunctuation.test(syllable)) {
          if (current.length) result.push({ kind: 'my', syllables: current });
          current = [];
        } else current.push(syllable);
      }
      if (current.length) result.push({ kind: 'my', syllables: current });
      continue;
    }
    for (const piece of run.text.split(hanRun)) {
      if (!piece) continue;
      if (isHan.test(piece)) result.push({ kind: 'han', chars: [...piece] });
      else
        for (const word of piece.match(/[\p{L}\p{N}]+/gu) ?? [])
          result.push({ kind: 'word', text: word });
    }
  }
  return result;
}

const pairs = (chars: string[]): string[] =>
  chars.slice(1).map((char, i) => `${chars[i]}${char}`);

/** Every term a text is indexed under. */
export function indexTerms(text: string): string[] {
  const terms: string[] = [];
  for (const unit of units(text)) {
    if (unit.kind === 'word') terms.push(unit.text);
    else if (unit.kind === 'han')
      terms.push(...unit.chars, ...pairs(unit.chars));
    else
      for (let n = 1; n <= MAX_GRAM; n++)
        for (let i = 0; i + n <= unit.syllables.length; i++)
          terms.push(unit.syllables.slice(i, i + n).join(''));
  }
  return terms;
}

/**
 * Terms one query chunk must match: whole words; Burmese runs whole when short, else overlapping
 * 3-syllable windows; Chinese runs as their character pairs (a single character as itself).
 */
export function chunkTerms(chunk: string): string[] {
  const terms: string[] = [];
  for (const unit of units(chunk)) {
    if (unit.kind === 'word') terms.push(unit.text);
    else if (unit.kind === 'han')
      terms.push(...(unit.chars.length === 1 ? unit.chars : pairs(unit.chars)));
    else if (unit.syllables.length <= MAX_GRAM)
      terms.push(unit.syllables.join(''));
    else
      for (let i = 0; i + MAX_GRAM <= unit.syllables.length; i++)
        terms.push(unit.syllables.slice(i, i + MAX_GRAM).join(''));
  }
  return terms;
}

/** Normalized text with spaces removed, for title tiers and similarity. */
export const compact = (value: string): string =>
  normalizeSearch(value).replace(/\s+/g, '');

const bigrams = (value: string): Set<string> => {
  const chars = [...value];
  return new Set(chars.slice(1).map((char, i) => `${chars[i]}${char}`));
};
/** Dice coefficient over character pairs: typos keep most pairs, long unrelated titles score low. */
export function similarity(query: string, title: string): number {
  const wanted = bigrams(query);
  const have = bigrams(title);
  if (!wanted.size || !have.size) return 0;
  let shared = 0;
  for (const pair of wanted) if (have.has(pair)) shared++;
  return (2 * shared) / (wanted.size + have.size);
}

/** 0 exact, 1 starts with the query, 2 contains it, 3 neither (both compacted). */
export const titleTier = (query: string, title: string): number =>
  title === query
    ? 0
    : title.startsWith(query)
      ? 1
      : title.includes(query)
        ? 2
        : 3;

/**
 * The two queries both searches run: `strict` needs every space-separated chunk (AND), with a
 * prefix allowed only on the very last term; `loose` is the fuzzy OR fallback for "similar".
 * Undefined when the query has no searchable terms.
 */
export function buildQueries(
  query: string,
): { strict: Query; loose: Query } | undefined {
  const termsPerChunk = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(chunkTerms)
    .filter((terms) => terms.length);
  if (!termsPerChunk.length) return undefined;
  const last = termsPerChunk.length - 1;
  const lastOnly = (_term: string, i: number, all: string[]): boolean =>
    i === all.length - 1;
  return {
    strict: {
      combineWith: 'AND',
      queries: termsPerChunk.map((terms, chunk) => ({
        combineWith: 'AND',
        queries: [terms.join(TERM_SEPARATOR)],
        prefix: chunk === last ? lastOnly : false,
      })),
    },
    loose: {
      combineWith: 'OR',
      queries: termsPerChunk.map((terms, chunk) => ({
        combineWith: 'OR',
        queries: [terms.join(TERM_SEPARATOR)],
        prefix: chunk === last ? lastOnly : false,
        fuzzy: (term: string) => (term.length >= 4 ? 0.25 : false),
      })),
    },
  };
}
