// Golden queries against the committed posts (built straight from the files, as the build does).
// They name real posts: if a post they rely on is legitimately changed or removed, point the
// test at one that still fits; never loosen an assertion to hide a ranking regression.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import tagRecords from '../../content/post-tags.json';
import { isPostLanguage } from './languages';
import { parsePost } from './parse';
import { sortPosts } from './posts';
import { PostSearch } from './search';
import {
  plainText,
  searchDocs,
  searchRecords,
  type SearchablePost,
} from './search-docs';
import { toSimplified } from './simplified';
import { parseTagRegistry } from './tags';
import { postTagSlugs } from './validate';

const dir = new URL('../../content/posts/', import.meta.url);
const registry = parseTagRegistry(tagRecords, toSimplified);
const posts: SearchablePost[] = sortPosts(
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const { post } = parsePost(
        name,
        readFileSync(new URL(name, dir), 'utf8'),
      );
      return {
        id: post.id,
        created: post.frontmatter.get('created')?.value ?? '',
        tags: postTagSlugs(post, registry),
        sections: post.sections.flatMap((section) =>
          isPostLanguage(section.lang)
            ? [
                {
                  lang: section.lang,
                  title: section.title,
                  text: plainText(section.body),
                },
              ]
            : [],
        ),
      };
    }),
);
const search = PostSearch.build(
  searchRecords(posts),
  searchDocs(posts, registry.tags),
  toSimplified,
);
const ids = (query: string) =>
  search.search(query).exact.map((hit) => hit.record.id);
const first = (query: string) => ids(query)[0];

const lobhaPosts = [
  '2026-10-11-guidance-on-overcoming-greed',
  '2026-10-11-study-on-greed-lobha-and-various-metaphors',
  '2026-10-11-synonyms-of-lobha-greed-attachment',
  '2026-10-11-the-four-characteristics-tetrad-of-greed-lobha',
  '2026-10-11-understanding-lobha-raga-and-tanha',
];

describe('plainText', () => {
  it('keeps link text and drops markup, link targets and fences', () => {
    expect(
      plainText(
        '## Part\n\n**Bold** _it_ [link](https://example.org/x) `code`\n\n```\nfence\n```\n> quote',
      ),
    ).toBe('Part Bold it link code fence quote');
  });
});

describe('post search (golden queries)', () => {
  it('finds every Lobha post from the Burmese word, titles first', () => {
    const found = ids('လောဘ');
    expect(found).toEqual(expect.arrayContaining(lobhaPosts));
    expect(found.slice(0, 5).sort()).toEqual([...lobhaPosts].sort());
  });
  it('finds a post from a Burmese word in its title', () => {
    expect(first('ပရိယာယ်')).toBe(
      '2026-10-11-synonyms-of-lobha-greed-attachment',
    );
  });
  it('finds English words, prefixes and diacritic-free spellings', () => {
    expect(first('Sekkha')).toBe(
      '2026-10-11-what-is-a-sekkha-person-sekkha-puggala',
    );
    expect(ids('anuva')).toContain('2026-10-11-meaning-of-vidhi-and-anuvada');
    expect(ids('pali')).toContain('2026-10-11-meaning-of-vidhi-and-anuvada');
  });
  it('ranks a title match first', () => {
    expect(first('Kusala')).toBe(
      '2026-10-11-meaning-and-types-of-wholesome-actions-kusala',
    );
  });
  it('finds Chinese text, and Traditional queries find the Simplified posts', () => {
    expect(first('有学')).toBe(
      '2026-10-11-what-is-a-sekkha-person-sekkha-puggala',
    );
    expect(ids('貪')).toEqual(ids('贪'));
    expect(ids('貪')).toEqual(expect.arrayContaining(lobhaPosts));
  });
  it('finds posts by a topic name in any language', () => {
    expect(ids('Abhidhamma')).toContain(
      '2026-10-11-the-four-characteristics-tetrad-of-greed-lobha',
    );
    expect(ids('阿毗达摩')).toContain(
      '2026-10-11-the-four-characteristics-tetrad-of-greed-lobha',
    );
  });
  it('returns nothing for nonsense or a blank query', () => {
    expect(ids('zzqqxx')).toEqual([]);
    expect(search.search('   ')).toEqual({ exact: [], similar: [] });
  });
  it('survives serialization', () => {
    const loaded = PostSearch.load(
      searchRecords(posts),
      search.serialize(),
      toSimplified,
    );
    expect(loaded.search('လောဘ').exact.map((hit) => hit.record.id)).toEqual(
      ids('လောဘ'),
    );
  });
});

// The browser downloads this index on first search. If this fails as posts grow, shrink the
// index (for example fewer Burmese n-grams for body text) or split it; see AGENTS.md §7.
describe('index size budget', () => {
  it('stays small per post and in total', () => {
    const gzipped = gzipSync(search.serialize()).length;
    expect(gzipped / posts.length).toBeLessThan(10_000);
    expect(gzipped).toBeLessThan(400_000);
  });
});
