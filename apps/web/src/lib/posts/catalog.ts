// Build-time access to the posts collection (content.config.ts), newest first, and the tag
// registry (src/content/post-tags.json; the content loader has already validated both).
import { getCollection } from 'astro:content';
import tagRecords from '../../content/post-tags.json';
import { sortPosts, type Post } from './posts.ts';
import { toSimplified } from './simplified.ts';
import { parseTagRegistry, type PostTag } from './tags.ts';

export async function loadPosts(): Promise<Post[]> {
  const entries = await getCollection('posts');
  return sortPosts(entries.map((entry) => ({ id: entry.id, ...entry.data })));
}

export const loadPostTags = (): PostTag[] =>
  parseTagRegistry(tagRecords, toSimplified).tags;
