// Checks on a commit's changes to post files (the `dhamma-posts` pre-commit hook, run by
// scripts/validate-posts.mjs --staged): a changed post must have a new "updated" date, and a
// renamed or deleted post breaks its published URL. Pure: the script supplies the git data.
import { parsePost } from './parse.ts';

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
