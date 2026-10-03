import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import {
  pageSchema,
  resourceSchema,
  categorySchema,
  classSchema,
} from './lib/schemas';
// Phase 0 is deliberately fixture-only. Phase 1 switches these loaders to curated content.
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
    loader: file('src/fixtures/classes.json'),
    schema: classSchema,
  }),
};
