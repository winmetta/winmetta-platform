// Full-text search over Dhamma posts: titles, tag names and body text in every post language,
// built at build time (search-data.ts) and loaded lazily by the posts index (PostSearch.astro).
// Same terms and query rules as the Dhamma Library (search-text.ts); queries typed in
// Traditional Chinese are converted to Simplified, which every post uses.
import MiniSearch, { type Options } from 'minisearch';
import type { PostLanguage } from './languages.ts';
import {
  buildQueries,
  compact,
  indexTerms,
  MIN_SIMILARITY,
  similarity,
  TERM_SEPARATOR,
  titleTier,
} from '../search-text.ts';

/** What the browser needs to show a result: the same as a post list item. */
export interface PostSearchRecord {
  id: string;
  created: string;
  titles: Record<PostLanguage, string>;
}

/** The indexed text of one post (build time only; not sent to the browser). */
export interface PostSearchDoc {
  id: string;
  /** All titles. */
  title: string;
  /** Every name of every tag on the post. */
  tags: string;
  /** All section bodies as plain text. */
  body: string;
}

const options: Options<PostSearchDoc> = {
  fields: ['title', 'tags', 'body'],
  storeFields: [],
  tokenize: indexTerms,
  processTerm: (term) => term,
  searchOptions: {
    tokenize: (query) => query.split(TERM_SEPARATOR),
    processTerm: (term) => term,
    boost: { title: 3, tags: 2, body: 1 },
  },
};

export interface PostSearchHit {
  record: PostSearchRecord;
  /** Best title tier over the three titles: 0 exact, 1 starts with, 2 contains, 3 elsewhere. */
  tier: number;
  score: number;
  similarity: number;
}

const han = /\p{Script=Han}/u;

export class PostSearch {
  private readonly order = new Map<string, number>();
  private readonly byId = new Map<string, PostSearchRecord>();

  private constructor(
    records: readonly PostSearchRecord[],
    private readonly index: MiniSearch<PostSearchDoc>,
    private readonly toSimplified: (text: string) => string,
  ) {
    records.forEach((record, position) => {
      this.order.set(record.id, position);
      this.byId.set(record.id, record);
    });
  }

  /** `records` newest first: that order breaks ties. */
  static build(
    records: readonly PostSearchRecord[],
    docs: readonly PostSearchDoc[],
    toSimplified: (text: string) => string,
  ): PostSearch {
    const index = new MiniSearch<PostSearchDoc>(options);
    index.addAll(docs);
    return new PostSearch(records, index, toSimplified);
  }

  static load(
    records: readonly PostSearchRecord[],
    serialized: string,
    toSimplified: (text: string) => string,
  ): PostSearch {
    return new PostSearch(
      records,
      MiniSearch.loadJSON<PostSearchDoc>(serialized, options),
      toSimplified,
    );
  }

  serialize(): string {
    return JSON.stringify(this.index);
  }

  search(
    raw: string,
    { similarLimit = 10 }: { similarLimit?: number } = {},
  ): { exact: PostSearchHit[]; similar: PostSearchHit[] } {
    const query = han.test(raw) ? this.toSimplified(raw) : raw;
    const queries = buildQueries(query);
    if (!queries) return { exact: [], similar: [] };
    const q = compact(query);
    const hit = (id: string, score: number): PostSearchHit | undefined => {
      const record = this.byId.get(id);
      if (!record) return undefined;
      const titles = Object.values(record.titles).map(compact);
      return {
        record,
        tier: Math.min(...titles.map((title) => titleTier(q, title))),
        score,
        similarity: Math.max(...titles.map((title) => similarity(q, title))),
      };
    };
    const position = (h: PostSearchHit) => this.order.get(h.record.id) ?? 0;
    const exact = this.index
      .search(queries.strict)
      .flatMap((r) => hit(r.id, r.score) ?? [])
      .sort(
        (a, b) =>
          a.tier - b.tier || b.score - a.score || position(a) - position(b),
      );
    const seen = new Set(exact.map((h) => h.record.id));
    const similar = this.index
      .search(queries.loose)
      .filter((r) => !seen.has(r.id))
      .flatMap((r) => hit(r.id, r.score) ?? [])
      .filter((h) => h.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity || b.score - a.score)
      .slice(0, similarLimit);
    return { exact, similar };
  }
}
