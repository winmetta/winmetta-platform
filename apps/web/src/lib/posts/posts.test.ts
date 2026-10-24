import { describe, expect, it } from 'vitest';
import { postListRoute } from '../../i18n/routes';
import {
  listingPages,
  listingSegment,
  POSTS_PAGE_SIZE,
  recentPosts,
  relatedTags,
  sortPosts,
  usedTags,
} from './posts';
import { POST_SLUG_MAX, postFilename, slugifyTitle } from './slug';

describe('slugifyTitle', () => {
  it.each([
    ['Meaning of Vidhi and Anuvāda', 'meaning-of-vidhi-and-anuvada'],
    [
      'What is a Sekkha person (Sekkha Puggala)?',
      'what-is-a-sekkha-person-sekkha-puggala',
    ],
    ['Sotāpatti-maggaṭṭha & Pāḷi', 'sotapatti-maggattha-pali'],
    ['  Dukkha — “suffering”  ', 'dukkha-suffering'],
  ])('%s -> %s', (title, slug) => {
    expect(slugifyTitle(title)).toBe(slug);
  });
  it('cuts long titles at a word boundary', () => {
    const slug = slugifyTitle(
      'The Four Characteristics of Greed according to the Commentaries and Subcommentaries',
    );
    expect(slug.length).toBeLessThanOrEqual(POST_SLUG_MAX);
    expect(slug).toBe('the-four-characteristics-of-greed-according-to-the');
  });
  it('builds the dated file name', () => {
    expect(postFilename('2026-10-23', 'Greed (Lobha)')).toBe(
      '2026-10-23-greed-lobha.md',
    );
  });
});

describe('post lists', () => {
  const posts = [
    { id: '2026-10-11-b', created: '2026-10-11', tags: ['lobha'] },
    { id: '2026-10-20-c', created: '2026-10-20', tags: ['kamma'] },
    { id: '2026-10-11-a', created: '2026-10-11', tags: ['lobha', 'kamma'] },
  ];
  it('sorts newest first, or oldest first, stably', () => {
    expect(sortPosts(posts).map((post) => post.id)).toEqual([
      '2026-10-20-c',
      '2026-10-11-b',
      '2026-10-11-a',
    ]);
    expect(sortPosts(posts, 'oldest').map((post) => post.id)).toEqual([
      '2026-10-11-a',
      '2026-10-11-b',
      '2026-10-20-c',
    ]);
  });
  it('takes the latest posts', () => {
    expect(recentPosts(posts, 1).map((post) => post.id)).toEqual([
      '2026-10-20-c',
    ]);
  });
  it('counts only tags that have posts', () => {
    const tag = (slug: string) => ({
      slug,
      names: { my: slug, en: slug, 'zh-Hans': slug },
    });
    expect(
      usedTags([tag('lobha'), tag('kamma'), tag('unused')], posts).map(
        ({ tag: { slug }, count }) => [slug, count],
      ),
    ).toEqual([
      ['lobha', 2],
      ['kamma', 2],
    ]);
  });
  it('lists related topics: other tags on the same posts, most shared first', () => {
    const tag = (slug: string) => ({
      slug,
      names: { my: slug, en: slug, 'zh-Hans': slug },
    });
    const tagged = [
      { tags: ['kusala', 'kamma'] },
      { tags: ['kusala', 'abhidhamma', 'kamma'] },
      { tags: ['lobha', 'abhidhamma'] },
      { tags: ['kusala'] },
    ];
    expect(
      relatedTags(
        ['abhidhamma', 'kamma', 'kusala', 'lobha'].map(tag),
        tagged,
        'kusala',
      ).map(({ tag: { slug }, count }) => [slug, count]),
    ).toEqual([
      ['kamma', 2],
      ['abhidhamma', 1],
    ]);
  });
});

describe('pagination', () => {
  const many = Array.from({ length: 101 }, (_, i) => ({
    id: `post-${String(i).padStart(3, '0')}`,
    created: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
  }));
  it('splits each order into pages of 50', () => {
    expect(POSTS_PAGE_SIZE).toBe(50);
    const pages = listingPages(many);
    expect(
      pages.map(({ sort, page, pages: n, items }) => [
        sort,
        page,
        n,
        items.length,
      ]),
    ).toEqual([
      ['newest', 1, 3, 50],
      ['newest', 2, 3, 50],
      ['newest', 3, 3, 1],
      ['oldest', 1, 3, 50],
      ['oldest', 2, 3, 50],
      ['oldest', 3, 3, 1],
    ]);
    const newest = pages
      .filter((p) => p.sort === 'newest')
      .flatMap((p) => p.items);
    const oldest = pages
      .filter((p) => p.sort === 'oldest')
      .flatMap((p) => p.items);
    expect(oldest).toEqual([...newest].reverse());
  });
  it('has one page when everything fits, even with no posts', () => {
    expect(listingPages(many.slice(0, 50)).map((p) => p.pages)).toEqual([1, 1]);
    expect(listingPages([]).map((p) => [p.page, p.items.length])).toEqual([
      [1, 0],
      [1, 0],
    ]);
  });
  it('builds URLs with no page segment on page 1', () => {
    expect(listingSegment('newest', 1)).toBeUndefined();
    expect(listingSegment('newest', 2)).toBe('page/2');
    expect(listingSegment('oldest', 1)).toBe('oldest');
    expect(listingSegment('oldest', 3)).toBe('oldest/page/3');
    expect(postListRoute('en', {})).toBe('/en/dhamma-posts/');
    expect(postListRoute('my', { sort: 'oldest', page: 2 })).toBe(
      '/my/dhamma-posts/oldest/page/2/',
    );
    expect(postListRoute('en', { tag: 'lobha', page: 2 })).toBe(
      '/en/dhamma-posts/tags/lobha/page/2/',
    );
  });
});
