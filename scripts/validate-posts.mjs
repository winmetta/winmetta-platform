#!/usr/bin/env node
// Checks Dhamma post files (apps/web/src/content/posts/*.md) and the tag registry with the same
// rules the build uses (apps/web/src/lib/posts/validate.ts).
//   npm run posts:validate                  every post in the working tree
//   npm run posts:validate -- <file.md>…    only these files
//   node scripts/validate-posts.mjs --staged   the git index (pre-commit hook), compared with HEAD
//   npm run posts:validate -- --base <ref>      the working tree compared with <ref> (CI: the
//                                           pull request's base)
// Compared with an earlier version, it also fails when a changed post keeps the same "updated"
// date or a tag slug with a published page disappears, and warns when a post is renamed or
// deleted.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localToday } from '../apps/web/src/lib/posts/loader.ts';
import { toSimplified } from '../apps/web/src/lib/posts/simplified.ts';
import {
  parseNameStatus,
  publishedTagSlugs,
  removedTagSlugProblems,
  stagedPostProblems,
} from '../apps/web/src/lib/posts/staged.ts';
import {
  buildTagRegistry,
  parseTagRegistry,
} from '../apps/web/src/lib/posts/tags.ts';
import { checkPost, formatIssues } from '../apps/web/src/lib/posts/validate.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const postsDir = 'apps/web/src/content/posts';
const tagsPath = 'apps/web/src/content/post-tags.json';
const args = process.argv.slice(2);
const staged = args.includes('--staged');
const baseAt = args.indexOf('--base');
const baseArg = baseAt >= 0 ? args[baseAt + 1] : undefined;
if (baseAt >= 0 && !baseArg) {
  console.error('Usage: --base <git ref>');
  process.exit(2);
}
// git's own error output is captured (a missing file at an old commit is an expected case); a
// failure still throws with it in the message.
const git = (...gitArgs) =>
  execFileSync('git', gitArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/** File text from the git index (staged) or the working tree. */
const read = (path) =>
  staged ? git('show', `:${path}`) : readFileSync(`${root}/${path}`, 'utf8');

const errors = [];
const warnings = [];

// Tag registry: every tag needs English, Burmese and Chinese names, and no name may belong to
// two tags.
let tags = buildTagRegistry([], toSimplified);
try {
  tags = parseTagRegistry(JSON.parse(read(tagsPath)), toSimplified);
  for (const issue of tags.issues) errors.push(`${tagsPath}: ${issue}`);
} catch (error) {
  errors.push(`${tagsPath}: ${error instanceof Error ? error.message : error}`);
}

// Which posts
let paths;
const named = args.filter(
  (arg, i) => !arg.startsWith('--') && !(baseAt >= 0 && i === baseAt + 1),
);
if (named.length) {
  paths = named.map((path) =>
    relative(root, existsSync(path) ? path : `${root}/${path}`),
  );
} else if (staged) {
  paths = git('ls-files', '--', `${postsDir}/*.md`).split('\n').filter(Boolean);
} else {
  paths = readdirSync(`${root}/${postsDir}`)
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${postsDir}/${name}`);
}

const today = localToday();
for (const path of paths) {
  if (!path.startsWith(`${postsDir}/`) || !path.endsWith('.md')) continue;
  let raw;
  try {
    raw = read(path);
  } catch {
    continue; // deleted in the index
  }
  const { issues } = checkPost(basename(path), raw, {
    tags,
    today,
    toSimplified,
  });
  if (issues.length) errors.push(formatIssues(path, issues));
}

// Compared with an earlier version (HEAD for the hook, --base in CI): keep "updated" honest,
// keep published tag slugs, and warn when a published post URL disappears.
const hasRef = (ref) => {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
};
const base = baseArg ?? (staged && hasRef('HEAD') ? 'HEAD' : undefined);
if (base) {
  if (!hasRef(base)) {
    console.error(`Unknown git ref for --base: ${base}`);
    process.exit(2);
  }
  const diff = staged
    ? git('diff', '--cached', '--name-status', '-M', '--', `${postsDir}/`)
    : git('diff', '--name-status', '-M', base, '--', `${postsDir}/`);
  const problems = stagedPostProblems(
    parseNameStatus(diff),
    { head: (path) => git('show', `${base}:${path}`), staged: read },
    today,
  );
  errors.push(...problems.errors);
  warnings.push(...problems.warnings);

  let registryThen;
  try {
    registryThen = JSON.parse(git('show', `${base}:${tagsPath}`));
  } catch {
    registryThen = undefined; // no tags yet at that version
  }
  if (registryThen !== undefined) {
    const postsThen = git(
      'ls-tree',
      '-r',
      '--name-only',
      base,
      '--',
      `${postsDir}/`,
    )
      .split('\n')
      .filter((path) => path.endsWith('.md'))
      .map((path) => ({
        name: basename(path),
        raw: git('show', `${base}:${path}`),
      }));
    errors.push(
      ...removedTagSlugProblems(
        publishedTagSlugs(registryThen, postsThen),
        tags,
        tagsPath,
      ),
    );
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(
    '\nDhamma post check failed. Format and rules: winmetta-platform/AGENTS.md, "Dhamma Posts".',
  );
  process.exit(1);
}
console.log(`Dhamma posts OK (${paths.length} checked).`);
