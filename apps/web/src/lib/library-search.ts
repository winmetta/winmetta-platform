import MiniSearch, { type Options, type Query } from 'minisearch';
import { burmeseSyllables, splitScripts } from './burmese.ts';
import { normalizeSearch } from './normalize.ts';
import type { LibraryFile } from './schemas.ts';

// Burmese is indexed as 1-3 syllable n-grams, so unspaced and half-typed queries
// match at syllable starts. Latin text is indexed as whole words.
const MAX_GRAM = 3;
const TERM_SEPARATOR = '\u0001';
// Fuzzy candidates below this character-pair similarity are noise, not "similar books".
const MIN_SIMILARITY = 0.2;
const myanmarPunctuation = /^[၊-၏]+$/;

type Unit =
  { kind: 'my'; syllables: string[] } | { kind: 'word'; text: string };

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
    } else {
      for (const word of run.text.match(/[\p{L}\p{N}]+/gu) ?? [])
        result.push({ kind: 'word', text: word });
    }
  }
  return result;
}

export function indexTerms(text: string): string[] {
  const terms: string[] = [];
  for (const unit of units(text)) {
    if (unit.kind === 'word') terms.push(unit.text);
    else
      for (let n = 1; n <= MAX_GRAM; n++)
        for (let i = 0; i + n <= unit.syllables.length; i++)
          terms.push(unit.syllables.slice(i, i + n).join(''));
  }
  return terms;
}

/** Terms one query chunk must match: whole short runs, else overlapping 3-syllable windows. */
function chunkTerms(chunk: string): string[] {
  const terms: string[] = [];
  for (const unit of units(chunk)) {
    if (unit.kind === 'word') terms.push(unit.text);
    else if (unit.syllables.length <= MAX_GRAM)
      terms.push(unit.syllables.join(''));
    else
      for (let i = 0; i + MAX_GRAM <= unit.syllables.length; i++)
        terms.push(unit.syllables.slice(i, i + MAX_GRAM).join(''));
  }
  return terms;
}

const compact = (value: string): string =>
  normalizeSearch(value).replace(/\s+/g, '');

const bigrams = (value: string): Set<string> => {
  const chars = [...value];
  return new Set(chars.slice(1).map((char, i) => `${chars[i]}${char}`));
};
/** Dice coefficient over character pairs: typos keep most pairs, long unrelated titles score low. */
function similarity(query: string, title: string): number {
  const wanted = bigrams(query);
  const have = bigrams(title);
  if (!wanted.size || !have.size) return 0;
  let shared = 0;
  for (const pair of wanted) if (have.has(pair)) shared++;
  return (2 * shared) / (wanted.size + have.size);
}

interface Doc {
  id: string;
  title: string;
  note: string;
  tags: string;
}

const options: Options<Doc> = {
  fields: ['title', 'note', 'tags'],
  storeFields: [],
  tokenize: indexTerms,
  processTerm: (term) => term,
  searchOptions: {
    // Queries are ready-made terms joined by TERM_SEPARATOR, never re-tokenized, so the
    // prefix/fuzzy callbacks see a chunk's real term list (and "last term" means last).
    tokenize: (query) => query.split(TERM_SEPARATOR),
    processTerm: (term) => term,
    boost: { title: 3, tags: 2, note: 1 },
  },
};

export interface SearchHit {
  record: LibraryFile;
  /** 0 exact title, 1 title starts with query, 2 title contains query, 3 other fields only. */
  tier: number;
  score: number;
  /** 0-1: character-pair similarity of query and title (orders similar books). */
  similarity: number;
}
export interface SearchResults {
  exact: SearchHit[];
  similar: SearchHit[];
}
export interface SearchOptions {
  tag?: string;
  similarLimit?: number;
}

export class LibrarySearch {
  private readonly order = new Map<string, number>();
  private readonly byId = new Map<string, LibraryFile>();
  private readonly tagsOf = new Map<string, Set<string>>();

  private readonly index: MiniSearch<Doc>;

  private constructor(records: readonly LibraryFile[], index: MiniSearch<Doc>) {
    this.index = index;
    records.forEach((record, position) => {
      this.order.set(record.id, position);
      this.byId.set(record.id, record);
      this.tagsOf.set(record.id, new Set(record.tags.map(normalizeSearch)));
    });
  }

  static build(records: readonly LibraryFile[]): LibrarySearch {
    const index = new MiniSearch<Doc>(options);
    index.addAll(
      records.map((r) => ({
        id: r.id,
        title: r.title,
        note: r.titleNote ?? '',
        tags: r.tags.join(' '),
      })),
    );
    return new LibrarySearch(records, index);
  }

  static load(
    records: readonly LibraryFile[],
    serialized: string,
  ): LibrarySearch {
    return new LibrarySearch(
      records,
      MiniSearch.loadJSON<Doc>(serialized, options),
    );
  }

  serialize(): string {
    return JSON.stringify(this.index);
  }

  search(
    query: string,
    { tag, similarLimit = 20 }: SearchOptions = {},
  ): SearchResults {
    const chunks = query.trim().split(/\s+/).filter(Boolean);
    const termsPerChunk = chunks
      .map(chunkTerms)
      .filter((terms) => terms.length);
    if (!termsPerChunk.length) return { exact: [], similar: [] };
    const wanted = tag === undefined ? undefined : normalizeSearch(tag);
    const filter = (result: { id: string }): boolean =>
      wanted === undefined ||
      (this.tagsOf.get(result.id)?.has(wanted) ?? false);
    const last = termsPerChunk.length - 1;
    const lastOnly = (_term: string, i: number, all: string[]): boolean =>
      i === all.length - 1;

    const strict: Query = {
      combineWith: 'AND',
      queries: termsPerChunk.map((terms, chunk) => ({
        combineWith: 'AND',
        queries: [terms.join(TERM_SEPARATOR)],
        prefix: chunk === last ? lastOnly : false,
      })),
    };
    const loose: Query = {
      combineWith: 'OR',
      queries: termsPerChunk.map((terms, chunk) => ({
        combineWith: 'OR',
        queries: [terms.join(TERM_SEPARATOR)],
        prefix: chunk === last ? lastOnly : false,
        fuzzy: (term: string) => (term.length >= 4 ? 0.25 : false),
      })),
    };

    const q = compact(query);
    const hit = (id: string, score: number): SearchHit | undefined => {
      const record = this.byId.get(id);
      if (!record) return undefined;
      const title = compact(record.title);
      const tier =
        title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
      return { record, tier, score, similarity: similarity(q, title) };
    };
    const exact = this.index
      .search(strict, { filter })
      .flatMap((r) => hit(r.id, r.score) ?? [])
      .sort(
        (a, b) =>
          a.tier - b.tier ||
          b.score - a.score ||
          (this.order.get(a.record.id) ?? 0) -
            (this.order.get(b.record.id) ?? 0),
      );
    const seen = new Set(exact.map((h) => h.record.id));
    const similar = this.index
      .search(loose, { filter })
      .filter((r) => !seen.has(r.id))
      .slice(0, similarLimit * 4)
      .flatMap((r) => hit(r.id, r.score) ?? [])
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          a.record.title.length - b.record.title.length ||
          b.score - a.score,
      )
      .filter((h) => h.similarity >= MIN_SIMILARITY)
      .slice(0, similarLimit);
    return { exact, similar };
  }
}
