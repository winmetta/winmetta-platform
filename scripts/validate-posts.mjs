#!/usr/bin/env node
// Checks Dhamma post files (apps/web/src/content/posts/*.md) and the tag registry with the same
// rules the build uses (apps/web/src/lib/posts/validate.ts).
//   npm run posts:validate                  every post in the working tree
//   npm run posts:validate -- <file.md>…    only these files
//   node scripts/validate-posts.mjs --staged   the git index (pre-commit hook); also fails when a
//                                           changed post keeps the same "updated" date
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localToday } from '../apps/web/src/lib/posts/loader.ts';
import { toSimplified } from '../apps/web/src/lib/posts/simplified.ts';
import {
  parseNameStatus,
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
const git = (...gitArgs) =>
  execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' });

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
const named = args.filter((arg) => !arg.startsWith('--'));
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

// Staged edits: keep "updated" honest, and warn when a published URL disappears.
if (staged) {
  const problems = stagedPostProblems(
    parseNameStatus(
      git('diff', '--cached', '--name-status', '-M', '--', `${postsDir}/`),
    ),
    {
      head: (path) => git('show', `HEAD:${path}`),
      staged: (path) => git('show', `:${path}`),
    },
    today,
  );
  errors.push(...problems.errors);
  warnings.push(...problems.warnings);
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
