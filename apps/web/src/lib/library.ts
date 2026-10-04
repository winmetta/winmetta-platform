import type { Resource } from './schemas';
import { normalizeSearch as normalize } from './normalize';
export interface LibraryFilters {
  query?: string;
  category?: string;
  type?: Resource['type'];
  language?: string;
}
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
