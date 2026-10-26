#!/usr/bin/env node
// Starts a new Dhamma post from its English title:
//   npm run posts:new -- "Meaning of Vidhi and Anuvāda"
// writes apps/web/src/content/posts/<today>-meaning-of-vidhi-and-anuvada.md with today's dates
// and an empty section per language. The file name is the post's permanent URL; later title
// edits inside the file do not change it.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localToday } from '../apps/web/src/lib/posts/loader.ts';
import { postFilename } from '../apps/web/src/lib/posts/slug.ts';

const title = process.argv.slice(2).join(' ').trim();
const name = title ? postFilename(localToday(), title) : '';
if (!title || name === `${localToday()}-.md`) {
  console.error(
    'Usage: npm run posts:new -- "English title" (needs Latin letters or digits)',
  );
  process.exit(1);
}
const path = fileURLToPath(
  new URL(`../apps/web/src/content/posts/${name}`, import.meta.url),
);
if (existsSync(path)) {
  console.error(`${name} already exists; choose a different title.`);
  process.exit(1);
}
const today = localToday();
writeFileSync(
  path,
  `---
created: ${today}
updated: ${today}
tags: []
---

<!-- lang: my -->

#

<!-- lang: en -->

# ${title}

<!-- lang: zh-Hans -->

#
`,
);
console.log(`Created apps/web/src/content/posts/${name}
Next: add tags by their English names from apps/web/src/content/post-tags.json (add new tags there
first, with English, Burmese and Chinese names), write the Burmese, English and Simplified Chinese
sections, then run npm run posts:validate.`);
