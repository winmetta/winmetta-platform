// What gets indexed for each post (search.ts). Pure, so the build (search-data.ts) and the
// golden tests (search.test.ts, straight from the post files) index exactly the same text.
import type { PostLanguage } from './languages.ts';
import type { PostSearchDoc, PostSearchRecord } from './search.ts';
import type { PostTag } from './tags.ts';

/**
 * Markdown as plain words: link targets, code fences and markup are dropped; the tokenizer
 * ignores the remaining punctuation anyway.
 */
export const plainText = (markdown: string): string =>
  markdown
    .replace(/^\s*(```|~~~).*$/gm, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_>#|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface SearchablePost {
  id: string;
  created: string;
  /** Tag slugs. */
  tags: string[];
  sections: { lang: PostLanguage; title: string; text: string }[];
}

export function searchRecords(
  posts: readonly SearchablePost[],
): PostSearchRecord[] {
  return posts.map((post) => ({
    id: post.id,
    created: post.created,
    titles: Object.fromEntries(
      post.sections.map((section) => [section.lang, section.title]),
    ) as Record<PostLanguage, string>,
  }));
}

export function searchDocs(
  posts: readonly SearchablePost[],
  tags: readonly PostTag[],
): PostSearchDoc[] {
  const bySlug = new Map(tags.map((tag) => [tag.slug, tag]));
  return posts.map((post) => ({
    id: post.id,
    title: post.sections.map((section) => section.title).join('\n'),
    tags: post.tags
      .flatMap((slug) => {
        const tag = bySlug.get(slug);
        return tag ? Object.values(tag.names) : [];
      })
      .join('\n'),
    body: post.sections.map((section) => section.text).join('\n'),
  }));
}
