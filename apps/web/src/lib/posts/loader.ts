// Content-collection loader for Dhamma posts. Each file holds every language, so the stock glob
// loader (one markdown body per entry) does not fit: this one validates the file with the shared
// rules, renders each language section with Astro's own markdown pipeline and stores the HTML.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { plainText } from './search-docs.ts';
import { toSimplified } from './simplified.ts';
import { parseTagRegistry } from './tags.ts';
import { checkPost, formatIssues, postTagSlugs } from './validate.ts';

export const localToday = (): string => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

async function sync(context: LoaderContext, posts: URL, tagsFile: URL) {
  const tags = parseTagRegistry(
    JSON.parse(await readFile(tagsFile, 'utf8')),
    toSimplified,
  );
  if (tags.issues.length)
    throw new Error(
      `Invalid src/content/post-tags.json:\n${tags.issues.join('\n')}`,
    );
  const names = (await readdir(posts))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const failures: string[] = [];
  const entries = [];
  for (const name of names) {
    const fileUrl = new URL(name, posts);
    const raw = await readFile(fileUrl, 'utf8');
    const { post, issues } = checkPost(name, raw, {
      tags,
      today: localToday(),
      toSimplified,
    });
    const path = `src/content/posts/${name}`;
    if (issues.length) {
      failures.push(formatIssues(path, issues));
      continue;
    }
    const sections = await Promise.all(
      post.sections.map(async (section) => ({
        lang: section.lang,
        title: section.title,
        html: (await context.renderMarkdown(section.body, { fileURL: fileUrl }))
          .html,
        text: plainText(section.body),
      })),
    );
    const data = await context.parseData({
      id: post.id,
      data: {
        created: post.frontmatter.get('created')?.value,
        updated: post.frontmatter.get('updated')?.value,
        tags: postTagSlugs(post, tags),
        sections,
      },
      filePath: path,
    });
    entries.push({ id: post.id, data, digest: context.generateDigest(raw) });
  }
  if (failures.length)
    throw new Error(
      `Invalid Dhamma posts (run npm run posts:validate):\n${failures.join('\n')}`,
    );
  context.store.clear();
  for (const entry of entries) context.store.set(entry);
}

export function postsLoader(): Loader {
  return {
    name: 'winmetta-posts',
    load: async (context) => {
      const posts = new URL('content/posts/', context.config.srcDir);
      const tagsFile = new URL('content/post-tags.json', context.config.srcDir);
      await sync(context, posts, tagsFile);
      const watcher = context.watcher;
      if (!watcher) return;
      const dir = fileURLToPath(posts);
      const tagsPath = fileURLToPath(tagsFile);
      watcher.add([dir, tagsPath]);
      const reload = (changed: string) => {
        if (!changed.startsWith(dir) && changed !== tagsPath) return;
        // In dev a bad edit is logged and the last good posts stay up.
        sync(context, posts, tagsFile).catch((error: unknown) =>
          context.logger.error(
            error instanceof Error ? error.message : String(error),
          ),
        );
      };
      watcher.on('change', reload);
      watcher.on('add', reload);
      watcher.on('unlink', reload);
    },
  };
}
