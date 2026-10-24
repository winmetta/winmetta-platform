// Checks on a change compared with an earlier version (the `dhamma-posts` pre-commit hook and
// the CI step, both run by scripts/validate-posts.mjs): a changed post must have a new "updated"
// date, a renamed or deleted post breaks its published URL (a warning), and a used tag slug must
// never disappear (an error). Pure: the script supplies the git data.
import { parsePost } from './parse.ts';
import { parseTagRegistry, type TagRegistry } from './tags.ts';
import { postTagSlugs } from './validate.ts';

export interface PostChange {
  /** git status letter(s): M, A, D, R100, … */
  status: string;
  from: string;
  to: string;
}

/** `git diff --cached --name-status -M` output, one change per line. */
export const parseNameStatus = (output: string): PostChange[] =>
  output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status = '', from = '', to = from] = line.split('\t');
      return { status, from, to };
    });

const basename = (path: string): string =>
  (path.split('/').at(-1) ?? path).replace(/\.md$/, '');

/** The `updated` date and the rest of the file, so a changed post can be told apart from a bump. */
function split(raw: string, name: string) {
  const updated = parsePost(name, raw).post.frontmatter.get('updated')?.value;
  return { updated, rest: raw.replace(/^updated:.*$/m, '') };
}

export function stagedPostProblems(
  changes: readonly PostChange[],
  git: {
    /** The file as committed in HEAD. */
    head: (path: string) => string;
    /** The file as staged. */
    staged: (path: string) => string;
  },
  today: string,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const { status, from, to } of changes) {
    if (!from.endsWith('.md')) continue;
    const renamed = status.startsWith('R');
    if (renamed || status === 'D')
      warnings.push(
        `${from}: ${renamed ? 'renamed' : 'deleted'}. Its URL (/…/dhamma-posts/${basename(from)}/) stops working; links already shared will break.`,
      );
    if (status !== 'M' && !renamed) continue;
    const before = split(git.head(from), basename(from));
    const after = split(git.staged(to), basename(to));
    if (before.rest !== after.rest && before.updated === after.updated)
      errors.push(
        `${to}: the post changed but "updated" is still ${after.updated ?? '(missing)'}; set it to today (${today})`,
      );
  }
  return { errors, warnings };
}

/**
 * Tag slugs that have a published tag page in a past version of the repo: slugs some post there
 * uses (only used tags get pages). `registry` is that version's post-tags.json, `posts` its post
 * files.
 */
export function publishedTagSlugs(
  registry: unknown,
  posts: readonly { name: string; raw: string }[],
): Set<string> {
  // Only the slugs matter here, so the Chinese check needs no converter.
  const tags = parseTagRegistry(registry, (text) => text);
  return new Set(
    posts.flatMap(({ name, raw }) =>
      postTagSlugs(parsePost(name, raw).post, tags),
    ),
  );
}

/**
 * A tag slug is a permanent URL (/<locale>/dhamma-posts/tags/<slug>/): removing or renaming one
 * that has a page breaks links already shared. Names may change; slugs may not.
 */
export function removedTagSlugProblems(
  published: ReadonlySet<string>,
  next: TagRegistry,
  tagsPath: string,
): string[] {
  const kept = new Set(next.tags.map((tag) => tag.slug));
  return [...published]
    .filter((slug) => !kept.has(slug))
    .sort()
    .map(
      (slug) =>
        `${tagsPath}: tag slug "${slug}" is gone, but it has a published page (/…/dhamma-posts/tags/${slug}/) and shared links to it would break. Keep the entry with slug "${slug}"; change only its names.`,
    );
}
