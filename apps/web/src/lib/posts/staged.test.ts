import { describe, expect, it } from 'vitest';
import {
  parseNameStatus,
  publishedTagSlugs,
  removedTagSlugProblems,
  stagedPostProblems,
} from './staged';
import { buildTagRegistry } from './tags';

const dir = 'apps/web/src/content/posts';
const file = (updated: string, body = 'Body') =>
  `---\ncreated: 2026-10-11\nupdated: ${updated}\ntags: [Lobha]\n---\n\n${body}\n`;

/** Runs the check with HEAD and staged contents given per path. */
const check = (
  output: string,
  head: Record<string, string>,
  staged: Record<string, string>,
) =>
  stagedPostProblems(
    parseNameStatus(output),
    {
      head: (path) => head[path] ?? '',
      staged: (path) => staged[path] ?? '',
    },
    '2026-10-23',
  );

describe('parseNameStatus', () => {
  it('reads modified, added, deleted and renamed entries', () => {
    expect(
      parseNameStatus(
        `M\t${dir}/a.md\nA\t${dir}/b.md\nD\t${dir}/c.md\nR087\t${dir}/d.md\t${dir}/e.md\n`,
      ),
    ).toEqual([
      { status: 'M', from: `${dir}/a.md`, to: `${dir}/a.md` },
      { status: 'A', from: `${dir}/b.md`, to: `${dir}/b.md` },
      { status: 'D', from: `${dir}/c.md`, to: `${dir}/c.md` },
      { status: 'R087', from: `${dir}/d.md`, to: `${dir}/e.md` },
    ]);
  });
});

describe('stagedPostProblems', () => {
  const a = `${dir}/2026-10-11-a.md`;
  it('fails a changed post whose "updated" date did not change', () => {
    const { errors } = check(
      `M\t${a}`,
      { [a]: file('2026-10-11') },
      { [a]: file('2026-10-11', 'Edited body') },
    );
    expect(errors).toEqual([
      `${a}: the post changed but "updated" is still 2026-10-11; set it to today (2026-10-23)`,
    ]);
  });
  it('passes a changed post with a new date, and a date-only bump', () => {
    expect(
      check(
        `M\t${a}`,
        { [a]: file('2026-10-11') },
        { [a]: file('2026-10-23', 'Edited body') },
      ),
    ).toEqual({ errors: [], warnings: [] });
    expect(
      check(`M\t${a}`, { [a]: file('2026-10-11') }, { [a]: file('2026-10-23') })
        .errors,
    ).toEqual([]);
  });
  it('treats a quoted date as the same date', () => {
    expect(
      check(
        `M\t${a}`,
        { [a]: file('2026-10-11') },
        { [a]: file('"2026-10-11"', 'Edited body') },
      ).errors,
    ).toHaveLength(1);
  });
  it('ignores new posts and files that are not posts', () => {
    expect(
      check(`A\t${a}\nM\t${dir}/notes.txt`, {}, { [a]: file('2026-10-23') }),
    ).toEqual({ errors: [], warnings: [] });
  });
  it('warns when a published URL goes away, and still checks a renamed post', () => {
    const b = `${dir}/2026-10-11-b.md`;
    const { errors, warnings } = check(
      `D\t${a}\nR090\t${b}\t${dir}/2026-10-11-c.md`,
      { [b]: file('2026-10-11') },
      { [`${dir}/2026-10-11-c.md`]: file('2026-10-11', 'Edited body') },
    );
    expect(warnings).toEqual([
      `${a}: deleted. Its URL (/…/dhamma-posts/2026-10-11-a/) stops working; links already shared will break.`,
      `${b}: renamed. Its URL (/…/dhamma-posts/2026-10-11-b/) stops working; links already shared will break.`,
    ]);
    expect(errors).toHaveLength(1);
  });
});

describe('published tag slugs', () => {
  const tagsPath = 'apps/web/src/content/post-tags.json';
  const registry = [
    { slug: 'lobha', en: 'Lobha', my: 'လောဘ', 'zh-Hans': '贪' },
    { slug: 'kamma', en: 'Kamma', my: 'ကံ', 'zh-Hans': '业' },
    { slug: 'unused', en: 'Unused', my: 'မသုံး', 'zh-Hans': '未用' },
  ];
  const postsThen = [
    {
      name: '2026-10-11-a.md',
      raw: file('2026-10-11').replace('[Lobha]', '[လောဘ]'),
    },
    {
      name: '2026-10-11-b.md',
      raw: file('2026-10-11').replace('[Lobha]', '[kamma]'),
    },
  ];
  const next = (records: typeof registry) =>
    buildTagRegistry(records, (text) => text);
  it('are the slugs the posts used, whatever name they listed', () => {
    expect([...publishedTagSlugs(registry, postsThen)].sort()).toEqual([
      'kamma',
      'lobha',
    ]);
  });
  it('fail when a used slug is renamed or removed', () => {
    const published = publishedTagSlugs(registry, postsThen);
    const renamed = registry.map((tag) =>
      tag.slug === 'lobha' ? { ...tag, slug: 'greed' } : tag,
    );
    expect(removedTagSlugProblems(published, next(renamed), tagsPath)).toEqual([
      expect.stringContaining('tag slug "lobha" is gone'),
    ]);
    expect(
      removedTagSlugProblems(
        published,
        next(registry.filter((tag) => tag.slug !== 'kamma')),
        tagsPath,
      ),
    ).toEqual([expect.stringContaining('tag slug "kamma" is gone')]);
  });
  it('allow renaming names, and removing a tag no post used', () => {
    const published = publishedTagSlugs(registry, postsThen);
    const edited = registry
      .filter((tag) => tag.slug !== 'unused')
      .map((tag) =>
        tag.slug === 'lobha' ? { ...tag, en: 'Greed (Lobha)' } : tag,
      );
    expect(removedTagSlugProblems(published, next(edited), tagsPath)).toEqual(
      [],
    );
  });
});
