import type { Resource } from './schemas';
export interface LibraryFilters {
  query?: string;
  category?: string;
  type?: Resource['type'];
  language?: string;
}
// NFC also puts U+1037 and U+103A in canonical order. Zero-width spaces are
// invisible line-break hints often inserted into Burmese text, so ignore them.
const normalize = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/\u200B/g, '')
    .toLowerCase();
export function filterResources(
  resources: readonly Resource[],
  filters: LibraryFilters = {},
): Resource[] {
  const query = normalize(filters.query?.trim() ?? '');
  return resources.filter((item) => {
    if (filters.category && !item.categories.includes(filters.category))
      return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.language && !item.languages.includes(filters.language))
      return false;
    const fields = [
      ...Object.values(item.translations).flatMap((entry) => [
        entry.title,
        entry.description,
      ]),
      ...item.authors,
      ...item.tags,
    ];
    return !query || fields.some((field) => normalize(field).includes(query));
  });
}
