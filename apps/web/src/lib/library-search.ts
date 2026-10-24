import MiniSearch, { type Options } from 'minisearch';
import { normalizeSearch } from './normalize.ts';
import type { LibraryFile } from './schemas.ts';
import {
  buildQueries,
  compact,
  indexTerms,
  MIN_SIMILARITY,
  similarity,
  TERM_SEPARATOR,
  titleTier,
} from './search-text.ts';

/** The fields search and result cards need; the browser downloads only these. */
export type SearchRecord = Pick<
  LibraryFile,
  'id' | 'key' | 'title' | 'titleNote' | 'tags' | 'language' | 'sizeBytes'
>;

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
  record: SearchRecord;
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
  private readonly byId = new Map<string, SearchRecord>();
  private readonly tagsOf = new Map<string, Set<string>>();

  private readonly index: MiniSearch<Doc>;

  private constructor(
    records: readonly SearchRecord[],
    index: MiniSearch<Doc>,
  ) {
    this.index = index;
    records.forEach((record, position) => {
      this.order.set(record.id, position);
      this.byId.set(record.id, record);
      this.tagsOf.set(record.id, new Set(record.tags.map(normalizeSearch)));
    });
  }

  /** `records` must be in library order (`compareLibraryOrder`): it is the final tie-breaker. */
  static build(records: readonly SearchRecord[]): LibrarySearch {
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
    records: readonly SearchRecord[],
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
    const queries = buildQueries(query);
    if (!queries) return { exact: [], similar: [] };
    const { strict, loose } = queries;
    const wanted = tag === undefined ? undefined : normalizeSearch(tag);
    const filter = (result: { id: string }): boolean =>
      wanted === undefined ||
      (this.tagsOf.get(result.id)?.has(wanted) ?? false);

    const q = compact(query);
    const hit = (id: string, score: number): SearchHit | undefined => {
      const record = this.byId.get(id);
      if (!record) return undefined;
      const title = compact(record.title);
      return {
        record,
        tier: titleTier(q, title),
        score,
        similarity: similarity(q, title),
      };
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
