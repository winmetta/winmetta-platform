// The rules every Dhamma post file must follow. The content loader (so `astro build` fails), the
// validate-posts script (pre-commit and CI) and the golden test all run checkPost.
import { hasZawgyiMarker } from '../zawgyi.ts';
import { postLanguages } from './languages.ts';
import {
  parsePost,
  type ParsedPost,
  type ParsedSection,
  type PostIssue,
} from './parse.ts';
import { postFilenamePattern, slugifyTitle } from './slug.ts';
import type { TagRegistry } from './tags.ts';

export interface ValidateOptions {
  /** The tag registry (post-tags.json, built by tags.ts). */
  tags: TagRegistry;
  /** Today as YYYY-MM-DD; dates after tomorrow are rejected. */
  today: string;
  /** Traditional -> Simplified Chinese converter (simplified.ts); unchanged text is Simplified. */
  toSimplified: (text: string) => string;
}

const allowedKeys = ['created', 'updated', 'tags'];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const myanmar = /[\u1000-\u109F]/;
const han = /\p{Script=Han}/u;
// Raw HTML tags and comments; markdown autolinks (<https://…>) are fine.
const rawHtml = /<!--|<\/?[A-Za-z][\w-]*(?:\s[^>]*)?\/?>/;
const titleMarkup = /[*`<>[\]]|(^|\s)_|_($|\s|[),.;:])/;

/** Link and image targets on a line: [text](url), [ref]: url and <scheme:…> autolinks. */
const linkTargets = (text: string): string[] => [
  ...[...text.matchAll(/\]\(\s*<?([^)\s>]+)/g)].map((m) => m[1] ?? ''),
  ...[...text.matchAll(/^\s*\[[^\]]+\]:\s*<?([^\s>]+)/g)].map(
    (m) => m[1] ?? '',
  ),
  ...[...text.matchAll(/<([A-Za-z][A-Za-z0-9+.-]*:[^>\s]*)>/g)].map(
    (m) => m[1] ?? '',
  ),
];
/**
 * Only web, mail and relative links. Markdown passes link targets through to the page, so a
 * `javascript:` (or entity-disguised) target would run script when clicked.
 */
const safeLink = (url: string): boolean =>
  !/&#?[A-Za-z0-9]+;/.test(url) &&
  (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) || /^(https?|mailto):/i.test(url));

const validDate = (value: string): boolean => {
  if (!isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const addDays = (value: string, days: number): string => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Body lines outside fenced code blocks, with inline code removed. */
function proseLines(section: ParsedSection): { line: number; text: string }[] {
  const result: { line: number; text: string }[] = [];
  let fence: string | undefined;
  section.body.split('\n').forEach((text, i) => {
    const marker = /^\s*(```|~~~)/.exec(text)?.[1];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      return;
    }
    if (!fence)
      result.push({
        line: section.bodyLine + i,
        text: text.replace(/`[^`]*`/g, ''),
      });
  });
  return result;
}

function checkSection(
  section: ParsedSection,
  options: ValidateOptions,
  issues: PostIssue[],
) {
  const add = (line: number, message: string) =>
    issues.push({ line, message: `[${section.lang}] ${message}` });
  if (section.title && titleMarkup.test(section.title))
    add(
      section.titleLine,
      'Title must be plain text (no *, _, `, [ ], < >); markdown is not rendered in titles',
    );
  if (!section.body) add(section.line, 'Section has a title but no body');

  const prose = proseLines(section);
  prose.forEach(({ line, text }, i) => {
    if (/^#\s/.test(text))
      add(line, 'Only the section title may be a "# " heading; use ## or ###');
    const previous = prose[i - 1];
    if (/^=+\s*$/.test(text) && previous && previous.text.trim() !== '')
      add(line, 'Setext "===" headings are not allowed; use ## or ###');
    if (rawHtml.test(text)) add(line, 'Raw HTML is not allowed; use markdown');
    for (const url of linkTargets(text))
      if (!safeLink(url))
        add(
          line,
          `Link "${url.slice(0, 40)}" is not allowed; use an http(s), mailto or relative link`,
        );
  });

  const all = `${section.title}\n${section.body}`;
  if (section.lang === 'my') {
    if (!myanmar.test(all))
      add(section.line, 'Burmese section has no Burmese text');
    const lines = all.split('\n');
    lines.forEach((text, i) => {
      if (hasZawgyiMarker(text))
        add(
          i === 0 ? section.titleLine : section.bodyLine + i - 1,
          'Looks like Zawgyi; Burmese must be Unicode (convert it before adding)',
        );
    });
  }
  if (section.lang === 'en' && section.title && !slugifyTitle(section.title))
    add(
      section.titleLine,
      'English title must contain Latin letters or digits',
    );
  if (section.lang === 'zh-Hans') {
    if (!han.test(all))
      add(section.line, 'Chinese section has no Chinese text');
    const lines = all.split('\n');
    lines.forEach((text, i) => {
      if (!han.test(text)) return;
      const simplified = options.toSimplified(text);
      if (simplified === text) return;
      const from = [...text];
      const to = [...simplified];
      const pairs = new Set<string>();
      if (from.length === to.length)
        from.forEach((char, j) => {
          if (char !== to[j]) pairs.add(`${char}→${to[j] ?? ''}`);
        });
      add(
        i === 0 ? section.titleLine : section.bodyLine + i - 1,
        `Traditional Chinese characters; use Simplified${
          pairs.size ? ` (${[...pairs].slice(0, 8).join(' ')})` : ''
        }`,
      );
    });
  }
}

export function validatePost(
  post: ParsedPost,
  options: ValidateOptions,
): PostIssue[] {
  const issues: PostIssue[] = [];
  const name = postFilenamePattern.exec(post.filename);
  if (!name)
    issues.push({
      line: 1,
      message:
        'File name must be YYYY-MM-DD-english-title-slug.md (lowercase a-z, 0-9 and single dashes)',
    });

  for (const [key, { line }] of post.frontmatter)
    if (!allowedKeys.includes(key))
      issues.push({
        line,
        message: `Unknown frontmatter key "${key}" (allowed: ${allowedKeys.join(', ')})`,
      });

  const created = post.frontmatter.get('created');
  const updated = post.frontmatter.get('updated');
  const tomorrow = addDays(options.today, 1);
  for (const [key, entry] of [
    ['created', created],
    ['updated', updated],
  ] as const) {
    if (!entry)
      issues.push({ line: 1, message: `Missing "${key}: YYYY-MM-DD"` });
    else if (!validDate(entry.value))
      issues.push({
        line: entry.line,
        message: `"${key}" must be a date like 2026-10-23`,
      });
    else if (entry.value > tomorrow)
      issues.push({ line: entry.line, message: `"${key}" is in the future` });
  }
  if (
    created &&
    updated &&
    validDate(created.value) &&
    validDate(updated.value)
  ) {
    if (updated.value < created.value)
      issues.push({
        line: updated.line,
        message: '"updated" is before "created"',
      });
  }
  if (name?.[1] && created && name[1] !== created.value)
    issues.push({
      line: created.line,
      message: `File name date ${name[1]} must equal "created" (${created.value}); the file name is permanent, so fix "created" unless the post is new`,
    });

  const tagsLine = post.frontmatter.get('tags')?.line ?? 1;
  if (!post.frontmatter.has('tags') || post.tags.length === 0)
    issues.push({
      line: tagsLine,
      message: 'Add at least one tag: tags: [Lobha, Pāḷi terms]',
    });
  // A tag may be written by its English name (preferred), its slug or a Burmese or Chinese alias.
  const seen = new Map<string, string>();
  for (const name of post.tags) {
    const tag = options.tags.resolve(name);
    if (!tag) {
      issues.push({
        line: tagsLine,
        message: `Unknown tag "${name}"; add it to apps/web/src/content/post-tags.json with its English, Burmese and Chinese names first`,
      });
      continue;
    }
    const earlier = seen.get(tag.slug);
    if (earlier !== undefined)
      issues.push({
        line: tagsLine,
        message:
          earlier === name
            ? `Duplicate tag "${name}"`
            : `"${earlier}" and "${name}" are the same tag ("${tag.names.en}"); list it once`,
      });
    else seen.set(tag.slug, name);
  }

  const order = post.sections.map((section) => section.lang);
  for (const section of post.sections) {
    if (!(postLanguages as readonly string[]).includes(section.lang))
      issues.push({
        line: section.line,
        message: `Unknown language "${section.lang}" (use ${postLanguages.join(', ')})`,
      });
  }
  for (const lang of postLanguages) {
    const count = order.filter((code) => code === lang).length;
    if (count === 0)
      issues.push({
        line: post.sections.at(-1)?.line ?? 1,
        message: `Missing the <!-- lang: ${lang} --> section`,
      });
    if (count > 1)
      issues.push({
        line: post.sections.filter((s) => s.lang === lang)[1]?.line ?? 1,
        message: `More than one "${lang}" section`,
      });
  }
  const known = order.filter((code) =>
    (postLanguages as readonly string[]).includes(code),
  );
  const expected = postLanguages.filter((code) => known.includes(code));
  if (known.join() !== expected.join())
    issues.push({
      line: post.sections[0]?.line ?? 1,
      message: `Sections must be in the order ${postLanguages.join(', ')}`,
    });

  for (const section of post.sections) checkSection(section, options, issues);
  return issues.sort((a, b) => a.line - b.line);
}

/** The post's tags as slugs, in file order, unknown names and repeats dropped. */
export function postTagSlugs(post: ParsedPost, tags: TagRegistry): string[] {
  const slugs = post.tags.flatMap((name) => tags.resolve(name)?.slug ?? []);
  return [...new Set(slugs)];
}

/** Parses and validates one post file. */
export function checkPost(
  filename: string,
  raw: string,
  options: ValidateOptions,
): { post: ParsedPost; issues: PostIssue[] } {
  const { post, issues } = parsePost(filename, raw);
  return {
    post,
    issues: [...issues, ...validatePost(post, options)].sort(
      (a, b) => a.line - b.line,
    ),
  };
}

/** `path:line: message` lines for the terminal and build errors. */
export const formatIssues = (path: string, issues: PostIssue[]): string =>
  issues.map((issue) => `${path}:${issue.line}: ${issue.message}`).join('\n');
