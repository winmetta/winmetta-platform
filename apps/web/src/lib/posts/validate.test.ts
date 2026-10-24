import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tagRecords from '../../content/post-tags.json';
import { parsePost } from './parse';
import { toSimplified } from './simplified';
import { buildTagRegistry, parseTagRegistry } from './tags';
import { checkPost, postTagSlugs, type ValidateOptions } from './validate';

const testTags = buildTagRegistry(
  [
    { slug: 'lobha', en: 'Lobha', my: 'လောဘ', 'zh-Hans': '贪' },
    {
      slug: 'pali-terms',
      en: 'Pāḷi terms',
      my: 'ပါဠိ ဝေါဟာရ',
      'zh-Hans': '巴利术语',
    },
  ],
  toSimplified,
);
const options: ValidateOptions = {
  tags: testTags,
  today: '2026-10-23',
  toSimplified,
};

const post = ({
  frontmatter = 'created: 2026-10-11\nupdated: 2026-10-12\ntags: [lobha]',
  my = '# လောဘ\n\nလောဘ ဆိုသည်မှာ …',
  en = '# Greed\n\nGreed is …',
  zh = '# 贪\n\n贪是 …',
  order = ['my', 'en', 'zh-Hans'],
}: {
  frontmatter?: string;
  my?: string;
  en?: string;
  zh?: string;
  order?: string[];
} = {}) => {
  const bodies: Record<string, string> = { my, en, 'zh-Hans': zh };
  return `---\n${frontmatter}\n---\n\n${order
    .map((lang) => `<!-- lang: ${lang} -->\n\n${bodies[lang] ?? ''}\n`)
    .join('\n')}`;
};

const messages = (raw: string, filename = '2026-10-11-greed.md') =>
  checkPost(filename, raw, options).issues.map((issue) => issue.message);

describe('parsePost', () => {
  it('splits frontmatter and language sections', () => {
    const { post: parsed, issues } = parsePost('2026-10-11-greed.md', post());
    expect(issues).toEqual([]);
    expect(parsed.id).toBe('2026-10-11-greed');
    expect(parsed.tags).toEqual(['lobha']);
    expect(parsed.sections.map((s) => [s.lang, s.title, s.body])).toEqual([
      ['my', 'လောဘ', 'လောဘ ဆိုသည်မှာ …'],
      ['en', 'Greed', 'Greed is …'],
      ['zh-Hans', '贪', '贪是 …'],
    ]);
  });
  it.each([
    'tags: [lobha, Pāḷi terms]',
    'tags:\n  [\n    lobha,\n    Pāḷi terms,\n  ]',
    'tags:\n  - lobha\n  - "Pāḷi terms"',
    'tags:\n- lobha\n- Pāḷi terms',
  ])('reads tag lists: %s', (tagLine) => {
    const raw = post({
      frontmatter: `created: 2026-10-11\nupdated: 2026-10-11\n${tagLine}`,
    });
    expect(parsePost('x.md', raw).post.tags).toEqual(['lobha', 'Pāḷi terms']);
  });
  it('accepts quoted dates', () => {
    expect(
      messages(
        post({
          frontmatter:
            'created: "2026-10-11"\nupdated: \'2026-10-12\'\ntags: [lobha]',
        }),
      ),
    ).toEqual([]);
  });
  it('accepts CRLF line endings and a byte-order mark', () => {
    expect(messages(`\uFEFF${post().replace(/\n/g, '\r\n')}`)).toEqual([]);
  });
});

describe('checkPost', () => {
  it('accepts a valid post', () => {
    expect(messages(post())).toEqual([]);
  });
  it.each([
    ['Greed.md', 'File name must be YYYY-MM-DD'],
    ['2026-10-11-Greed.md', 'File name must be YYYY-MM-DD'],
    ['2026-10-12-greed.md', 'must equal "created"'],
  ])('rejects the file name %s', (filename, message) => {
    expect(messages(post(), filename).join('\n')).toContain(message);
  });
  it.each([
    ['created: 2026-10-11\ntags: [lobha]', 'Missing "updated'],
    [
      'created: 2026-13-01\nupdated: 2026-10-11\ntags: [lobha]',
      'must be a date',
    ],
    [
      'created: 2026-10-11\nupdated: 2026-10-10\ntags: [lobha]',
      'before "created"',
    ],
    [
      'created: 2026-10-11\nupdated: 2026-12-01\ntags: [lobha]',
      'in the future',
    ],
    ['created: 2026-10-11\nupdated: 2026-10-11\ntags: []', 'at least one tag'],
    [
      'created: 2026-10-11\nupdated: 2026-10-11\ntags: [greed]',
      'Unknown tag "greed"',
    ],
    [
      'created: 2026-10-11\nupdated: 2026-10-11\ntags: [lobha, lobha]',
      'Duplicate tag',
    ],
    [
      'created: 2026-10-11\nupdated: 2026-10-11\ntags: [lobha]\nauthor: x',
      'Unknown frontmatter key "author"',
    ],
  ])('rejects frontmatter %#', (frontmatter, message) => {
    expect(messages(post({ frontmatter })).join('\n')).toContain(message);
  });
  it('requires every language, once, in order', () => {
    expect(messages(post({ order: ['my', 'en'] })).join('\n')).toContain(
      'Missing the <!-- lang: zh-Hans --> section',
    );
    expect(
      messages(post({ order: ['en', 'my', 'zh-Hans'] })).join('\n'),
    ).toContain('Sections must be in the order my, en, zh-Hans');
    expect(
      messages(post({ order: ['my', 'en', 'zh-Hans', 'en'] })).join('\n'),
    ).toContain('More than one "en" section');
    expect(
      messages(post({ order: ['my', 'en', 'zh-Hans', 'fr'] })).join('\n'),
    ).toContain('Unknown language "fr"');
  });
  it('rejects text before the first marker', () => {
    const raw = post().replace(
      '<!-- lang: my -->',
      'Intro\n\n<!-- lang: my -->',
    );
    expect(messages(raw).join('\n')).toContain('Text before the first');
  });
  it.each([
    [{ en: 'Greed is …' }, 'must start with a "# Title"'],
    [{ en: '# Greed' }, 'no body'],
    [{ en: '# Greed\n\n# Another\n\ntext' }, 'Only the section title'],
    [{ en: '# Greed\n\nAnother\n===\n\ntext' }, 'Setext'],
    [{ en: '# Greed\n\n<div>text</div>' }, 'Raw HTML'],
    [{ en: '# Greed (_Lobha_)\n\ntext' }, 'Title must be plain text'],
    [{ en: '# ဗုဒ္ဓ\n\ntext' }, 'English title must contain Latin'],
  ])('rejects section %#', (sections, message) => {
    expect(messages(post(sections)).join('\n')).toContain(message);
  });
  it.each([
    ['<p\nstyle="color: red">text</p>', '<p'],
    ['Intro\n\n<div\n  class="x"\n>', '<div'],
    ['<!--\nhidden\n-->', '<!--'],
  ])('rejects raw HTML split over lines: %j', (body, start) => {
    const raw = post({ en: `# Greed\n\n${body}` });
    const issue = checkPost('2026-10-11-greed.md', raw, options).issues.find(
      (i) => i.message.includes('Raw HTML'),
    );
    // Reported on the line where the tag starts.
    expect(raw.split('\n')[(issue?.line ?? 0) - 1]).toBe(start);
  });
  it('does not join text across a blank line or a code fence into a tag', () => {
    const en = '# Greed\n\nA <b and\n\nc> d.\n\n<i\n```\ncode\n```\nx> y.';
    expect(messages(post({ en }))).toEqual([]);
  });
  it('allows headings, HTML and autolinks inside code and links', () => {
    const en =
      '# Greed\n\n## Part\n\nSee <https://example.org> and `<b>`.\n\n```\n# not a heading\n<div>\n```';
    expect(messages(post({ en }))).toEqual([]);
  });
  it.each([
    '[click](javascript:alert(1))',
    '![x](JavaScript:alert(1))',
    '[x](data:text/html;base64,AAAA)',
    '[x](javascript&colon;alert(1))',
    '<javascript:alert(1)>',
    '[ref]: vbscript:msgbox',
    '[x](\njavascript:alert(1))',
    '[ref]:\n  javascript:alert(1)',
  ])('rejects the unsafe link %s', (line) => {
    expect(messages(post({ en: `# Greed\n\n${line}` })).join('\n')).toContain(
      'is not allowed; use an http(s), mailto or relative link',
    );
  });
  it('accepts web, mail, relative and anchor links', () => {
    const en =
      '# Greed\n\n[a](https://example.org/x) [b](http://example.org) [c](mailto:contact@example.invalid) [d](/en/dhamma-posts/) [e](#part) <https://example.org>\n\n[ref]: https://example.org';
    expect(messages(post({ en }))).toEqual([]);
  });
  it('reports title and body problems on their own lines', () => {
    const raw = post({ zh: '# 貪\n\n贪是 …\n\n愛' });
    const lines = checkPost('2026-10-11-greed.md', raw, options)
      .issues.filter((issue) => issue.message.includes('Traditional'))
      .map((issue) => [issue.line, raw.split('\n')[issue.line - 1]]);
    expect(lines).toEqual([
      [expect.any(Number), '# 貪'],
      [expect.any(Number), '愛'],
    ]);
  });
  it('rejects Zawgyi Burmese', () => {
    expect(messages(post({ my: '# လောဘ\n\nေသာတတၳကီ' })).join('\n')).toContain(
      'Zawgyi',
    );
  });
  it('rejects Traditional Chinese and lists the characters', () => {
    const issues = messages(post({ zh: '# 貪愛\n\n貪是 …' }));
    expect(issues.join('\n')).toContain('貪→贪');
    expect(issues.join('\n')).toContain('愛→爱');
  });
});

describe('tag registry', () => {
  it('resolves the English name, its slug and every alias to one tag', () => {
    for (const name of ['Lobha', 'lobha', 'လောဘ', '贪', 'LOBHA'])
      expect(testTags.resolve(name)?.slug).toBe('lobha');
    for (const name of [
      'Pāḷi terms',
      'Pali terms',
      'pali-terms',
      'ပါဠိ ဝေါဟာရ',
    ])
      expect(testTags.resolve(name)?.slug).toBe('pali-terms');
  });
  it.each([
    [
      [
        { slug: 'lobha', en: 'Lobha', my: 'လောဘ', 'zh-Hans': '贪' },
        { slug: 'greed', en: 'Greed', my: 'လောဘ', 'zh-Hans': '贪欲' },
      ],
      '"လောဘ" is a name of two tags ("Lobha" and "Greed")',
    ],
    [
      [
        { slug: 'pali', en: 'Pāḷi terms', my: 'ပါဠိ', 'zh-Hans': '巴利' },
        {
          slug: 'pali-terms',
          en: 'Pali Terms',
          my: 'ပါဠိ ဝေါဟာရ',
          'zh-Hans': '巴利术语',
        },
      ],
      'is a name of two tags',
    ],
    [
      [{ slug: 'kamma', en: 'ကံ', my: 'ကံ', 'zh-Hans': '业' }],
      'needs Latin letters',
    ],
    [
      [{ slug: 'kamma', en: 'Kamma', my: 'Kamma', 'zh-Hans': '业' }],
      'no Burmese text',
    ],
    [
      [{ slug: 'kamma', en: 'Kamma', my: 'ကံ', 'zh-Hans': '業' }],
      'is Traditional; use "业"',
    ],
    [
      [{ slug: 'Kamma', en: 'Kamma', my: 'ကံ', 'zh-Hans': '业' }],
      'slug "Kamma" must be lowercase',
    ],
    [
      [
        { slug: 'kamma', en: 'Kamma', my: 'ကံ', 'zh-Hans': '业' },
        { slug: 'kamma', en: 'Action', my: 'ကမ္မ', 'zh-Hans': '行为' },
      ],
      'slug "kamma" is already used by "Kamma"',
    ],
    [
      [
        { slug: 'practice', en: 'Bhāvanā', my: 'ဘာဝနာ', 'zh-Hans': '修习' },
        {
          slug: 'patipatti',
          en: 'Practice',
          my: 'ကျင့်စဉ်',
          'zh-Hans': '修行',
        },
      ],
      'is a name of two tags',
    ],
  ])('rejects registry %#', (records, message) => {
    expect(buildTagRegistry(records, toSimplified).issues.join('\n')).toContain(
      message,
    );
  });
  it('rejects a tag without all three names', () => {
    expect(() =>
      parseTagRegistry(
        [{ slug: 'kamma', en: 'Kamma', my: 'ကံ' }],
        toSimplified,
      ),
    ).toThrow();
  });
  it('keeps the slug when the English name changes', () => {
    const renamed = buildTagRegistry(
      [{ slug: 'lobha', en: 'Greed (Lobha)', my: 'လောဘ', 'zh-Hans': '贪' }],
      toSimplified,
    );
    expect(renamed.issues).toEqual([]);
    expect(renamed.resolve('Greed (Lobha)')?.slug).toBe('lobha');
    expect(renamed.resolve('lobha')?.slug).toBe('lobha');
  });
  it('accepts posts listing tags by alias, and stores slugs', () => {
    const raw = post({
      frontmatter:
        'created: 2026-10-11\nupdated: 2026-10-11\ntags: [လောဘ, Pāḷi terms]',
    });
    const { post: parsed, issues } = checkPost(
      '2026-10-11-greed.md',
      raw,
      options,
    );
    expect(issues).toEqual([]);
    expect(postTagSlugs(parsed, testTags)).toEqual(['lobha', 'pali-terms']);
  });
  it('rejects one tag listed in two languages', () => {
    const raw = post({
      frontmatter:
        'created: 2026-10-11\nupdated: 2026-10-11\ntags: [Lobha, 贪]',
    });
    expect(messages(raw).join('\n')).toContain(
      '"Lobha" and "贪" are the same tag ("Lobha")',
    );
  });
});

describe('committed posts', () => {
  const dir = new URL('../../content/posts/', import.meta.url);
  const registry = parseTagRegistry(tagRecords, toSimplified);
  it('has a valid tag registry', () => {
    expect(registry.issues).toEqual([]);
  });
  it.each(readdirSync(dir).filter((name) => name.endsWith('.md')))(
    '%s passes the post rules',
    (name) => {
      const { issues } = checkPost(
        name,
        readFileSync(new URL(name, dir), 'utf8'),
        {
          tags: registry,
          today: new Date().toLocaleDateString('en-CA'),
          toSimplified,
        },
      );
      expect(issues).toEqual([]);
    },
  );
});
