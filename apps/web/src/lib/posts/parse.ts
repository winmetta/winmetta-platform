// Splits a Dhamma post file into frontmatter and one section per language. Pure (no Astro or
// Node imports) so the content loader, the validate-posts script and the tests share it.
//
//   ---
//   created: 2026-10-11
//   updated: 2026-10-11
//   tags: [lobha, abhidhamma]
//   ---
//
//   <!-- lang: my -->
//
//   # Burmese title
//
//   Burmese body …
//
//   <!-- lang: en -->
//   …

export interface PostIssue {
  /** 1-based line in the file. */
  line: number;
  message: string;
}

export interface ParsedSection {
  lang: string;
  title: string;
  /** Markdown after the title line. */
  body: string;
  /** Line of the `<!-- lang: … -->` marker. */
  line: number;
  /** Line of the `# Title` (the marker line when the title is missing). */
  titleLine: number;
  /** File line of the body's first line (`body` starts at its first non-blank line). */
  bodyLine: number;
}

export interface ParsedPost {
  /** File name without `.md`: the permanent id and URL slug. */
  id: string;
  filename: string;
  /** Raw frontmatter values; validatePost checks their format. */
  frontmatter: Map<string, { value: string; line: number }>;
  tags: string[];
  sections: ParsedSection[];
}

export const sectionMarker = /^<!--\s*lang:\s*([A-Za-z-]+)\s*-->\s*$/;

/**
 * Tag names from `tags: [Lobha, Pāḷi terms]`, a flow list prettier wrapped over lines, or a
 * `- Lobha` block list. Names may contain spaces, so only commas and list items separate them.
 */
export function tagsFrom(value: string): string[] {
  const text = value.trim();
  const flow = /^\[([\s\S]*)\]$/.exec(text);
  const items = flow
    ? (flow[1] ?? '').split(',')
    : /^\s*-\s/m.test(text)
      ? text.split('\n').map((line) => line.replace(/^\s*-\s*/, ''))
      : text.split(',');
  return items
    .map((item) =>
      item
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .trim(),
    )
    .filter((item) => item !== '');
}

export function parsePost(
  filename: string,
  raw: string,
): { post: ParsedPost; issues: PostIssue[] } {
  const issues: PostIssue[] = [];
  const lines = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const frontmatter = new Map<string, { value: string; line: number }>();
  const post: ParsedPost = {
    id: filename.replace(/\.md$/, ''),
    filename,
    frontmatter,
    tags: [],
    sections: [],
  };

  let index = 0;
  if (lines[0]?.trim() !== '---') {
    issues.push({
      line: 1,
      message: 'File must start with a --- frontmatter block',
    });
  } else {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end < 0) {
      issues.push({ line: 1, message: 'Frontmatter has no closing ---' });
      return { post, issues };
    }
    let key: string | undefined;
    for (let i = 1; i < end; i++) {
      const line = lines[i] ?? '';
      const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (match?.[1] !== undefined) {
        key = match[1];
        if (frontmatter.has(key))
          issues.push({ line: i + 1, message: `Duplicate "${key}"` });
        // A quoted scalar (`created: "2026-10-11"`) is the same value unquoted.
        const value = (match[2] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
        frontmatter.set(key, { value, line: i + 1 });
      } else if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      } else if (key && (/^\s/.test(line) || /^-(\s|$)/.test(line))) {
        // Continuation of the previous key: a wrapped flow list, or a block list item, which YAML
        // allows indented or not (`tags:` then `- Lobha`).
        const entry = frontmatter.get(key);
        if (entry) entry.value = `${entry.value}\n${line.trim()}`.trim();
      } else {
        issues.push({
          line: i + 1,
          message: `Unreadable frontmatter line: ${line}`,
        });
      }
    }
    const tags = frontmatter.get('tags');
    if (tags) post.tags = tagsFrom(tags.value);
    index = end + 1;
  }

  let current: { lang: string; line: number; lines: string[] } | undefined;
  const finish = () => {
    if (!current) return;
    const body = current.lines;
    const first = body.findIndex((line) => line.trim() !== '');
    const heading =
      first >= 0 ? /^#\s+(.+?)\s*#*\s*$/.exec(body[first] ?? '') : null;
    if (!heading?.[1]) {
      issues.push({
        line: current.line + 1 + Math.max(first, 0),
        message: `The "${current.lang}" section must start with a "# Title" line`,
      });
    }
    const start = heading ? first + 1 : 0;
    const rest = body.slice(start);
    // `body` is trimmed, so it begins at the first non-blank line after the title.
    const skipped = Math.max(
      0,
      rest.findIndex((line) => line.trim() !== ''),
    );
    post.sections.push({
      lang: current.lang,
      title: heading?.[1]?.trim() ?? '',
      body: rest.join('\n').trim(),
      line: current.line,
      titleLine: heading ? current.line + 1 + first : current.line,
      bodyLine: current.line + 1 + start + skipped,
    });
  };
  for (let i = index; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const marker = sectionMarker.exec(line);
    if (marker?.[1] !== undefined) {
      finish();
      current = { lang: marker[1], line: i + 1, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim() !== '') {
      issues.push({
        line: i + 1,
        message: 'Text before the first <!-- lang: … --> marker',
      });
      // Report once; the rest of the leading text is the same problem.
      while (i + 1 < lines.length && !sectionMarker.test(lines[i + 1] ?? ''))
        i++;
    }
  }
  finish();
  return { post, issues };
}
