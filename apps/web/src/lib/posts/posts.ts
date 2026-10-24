// Ordering and grouping for Dhamma post lists (index, tag pages, home).
import type { PostLanguage } from './languages.ts';
import type { PostTag } from './tags.ts';

export interface PostSection {
  lang: PostLanguage;
  title: string;
  html: string;
}

export interface Post {
  id: string;
  created: string;
  updated: string;
  /** Tag slugs (lib/posts/tags.ts), whatever names the file used. */
  tags: string[];
  sections: PostSection[];
}

export type PostSort = 'newest' | 'oldest';

/** Posts per listing page (posts index and tag pages), as on Dhamma Library folder pages. */
export const POSTS_PAGE_SIZE = 50;

export interface ListingPage<T> {
  sort: PostSort;
  /** 1-based. */
  page: number;
  pages: number;
  items: T[];
}

/** Every page of a listing in both orders: newest first and oldest first. */
export function listingPages<T extends Pick<Post, 'id' | 'created'>>(
  posts: readonly T[],
  size: number = POSTS_PAGE_SIZE,
): ListingPage<T>[] {
  return (['newest', 'oldest'] as const).flatMap((sort) => {
    const sorted = sortPosts(posts, sort);
    const pages = Math.max(1, Math.ceil(sorted.length / size));
    return Array.from({ length: pages }, (_, i) => ({
      sort,
      page: i + 1,
      pages,
      items: sorted.slice(i * size, (i + 1) * size),
    }));
  });
}

/** The rest-parameter value for a listing page: undefined, page/2, oldest or oldest/page/2. */
export function listingSegment(
  sort: PostSort,
  page: number,
): string | undefined {
  const parts = [
    sort === 'oldest' ? 'oldest' : '',
    page > 1 ? `page/${page}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('/') : undefined;
}

/** Newest first by default; posts created the same day keep a stable order by id. */
export function sortPosts<T extends Pick<Post, 'id' | 'created'>>(
  posts: readonly T[],
  sort: PostSort = 'newest',
): T[] {
  const sorted = [...posts].sort((a, b) =>
    a.created === b.created
      ? a.id.localeCompare(b.id)
      : a.created < b.created
        ? -1
        : 1,
  );
  return sort === 'newest' ? sorted.reverse() : sorted;
}

export const recentPosts = <T extends Pick<Post, 'id' | 'created'>>(
  posts: readonly T[],
  count: number,
): T[] => sortPosts(posts).slice(0, count);

export const postsWithTag = <T extends Pick<Post, 'tags'>>(
  posts: readonly T[],
  tag: string,
): T[] => posts.filter((post) => post.tags.includes(tag));

/** Tags that have posts, with counts, in registry order. */
export function usedTags(
  tags: readonly PostTag[],
  posts: readonly Pick<Post, 'tags'>[],
): { tag: PostTag; count: number }[] {
  return tags
    .map((tag) => ({ tag, count: postsWithTag(posts, tag.slug).length }))
    .filter(({ count }) => count > 0);
}

/**
 * Topics related to a tag: the other tags on its posts, each with how many of those posts carry
 * it. Most shared first, then registry order.
 */
export function relatedTags(
  tags: readonly PostTag[],
  posts: readonly Pick<Post, 'tags'>[],
  slug: string,
): { tag: PostTag; count: number }[] {
  const withTag = postsWithTag(posts, slug);
  return usedTags(
    tags.filter((tag) => tag.slug !== slug),
    withTag,
  ).sort((a, b) => b.count - a.count);
}

/** The section in a language, for page titles in the interface language. */
export const sectionIn = (
  post: Pick<Post, 'sections'>,
  lang: PostLanguage,
): PostSection | undefined =>
  post.sections.find((section) => section.lang === lang);

/** "October 23, 2026" in the interface locale, with Latin digits (as on the Privacy page). */
export const formatPostDate = (date: string, formatLocale: string): string =>
  new Intl.DateTimeFormat(formatLocale, {
    dateStyle: 'long',
    numberingSystem: 'latn',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
