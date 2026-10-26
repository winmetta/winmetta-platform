import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import {
  pageSchema,
  resourceSchema,
  categorySchema,
  classSchema,
  teacherSchema,
  retreatSchema,
  postSchema,
} from './lib/schemas';
import { postsLoader } from './lib/posts/loader';
// pages, resources and categories still load Phase 0 fixtures (not read by any page);
// classes, teachers and retreats are the curated public content.
export const collections = {
  pages: defineCollection({
    loader: file('src/fixtures/pages.json'),
    schema: pageSchema,
  }),
  resources: defineCollection({
    loader: file('src/fixtures/resources.json'),
    schema: resourceSchema,
  }),
  categories: defineCollection({
    loader: file('src/fixtures/categories.json'),
    schema: categorySchema,
  }),
  classes: defineCollection({
    loader: file('src/content/classes.json'),
    schema: classSchema,
  }),
  teachers: defineCollection({
    loader: file('src/content/teachers.json'),
    schema: teacherSchema,
  }),
  retreats: defineCollection({
    loader: file('src/content/retreats.json'),
    schema: retreatSchema,
  }),
  // Dhamma posts: src/content/posts/YYYY-MM-DD-slug.md, all languages in one file (AGENTS.md).
  posts: defineCollection({
    loader: postsLoader(),
    schema: postSchema,
  }),
};
