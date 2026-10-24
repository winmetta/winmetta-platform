import { describe, expect, it } from 'vitest';
import { parseNameStatus, stagedPostProblems } from './staged';

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
