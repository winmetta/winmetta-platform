// Post file names are `YYYY-MM-DD-<slug>.md`. The name (without .md) is the post's permanent id
// and URL. The slug comes from the English title once, when the post is created; later title
// edits do not rename the file, so shared links keep working.

export const POST_SLUG_MAX = 60;

export const postFilenamePattern =
  /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/** "Meaning of Vidhi and Anuvāda" -> "meaning-of-vidhi-and-anuvada". */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= POST_SLUG_MAX) return slug;
  const cut = slug.slice(0, POST_SLUG_MAX + 1);
  const boundary = cut.lastIndexOf('-');
  return (
    boundary > 0 ? cut.slice(0, boundary) : cut.slice(0, POST_SLUG_MAX)
  ).replace(/-+$/, '');
}

/** `2026-10-23-meaning-of-vidhi` from a date and an English title. */
export const postFilename = (date: string, englishTitle: string): string =>
  `${date}-${slugifyTitle(englishTitle)}.md`;
