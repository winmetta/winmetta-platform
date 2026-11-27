// Search state lives in the URL (?q=…&tag=…) so links, back/forward and the language switcher
// keep it. Pure helpers, shared by the search island and its tests.
export interface LibraryState {
  q: string;
  tag: string;
}

export function readState(search: string): LibraryState {
  const params = new URLSearchParams(search);
  return { q: params.get('q') ?? '', tag: params.get('tag') ?? '' };
}

/** The URL for a state, keeping the current path and fragment. */
export function writeState(
  state: LibraryState,
  location: { pathname: string; hash: string },
): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
}

/** Whether the locale's plural rules call this count "one" (English: 1 book, 2 books). */
export const isSingular = (value: number, formatLocale: string): boolean =>
  new Intl.PluralRules(formatLocale).select(value) === 'one';

/** The digits of an interface locale: Burmese digits (၁၂) in Burmese, Latin elsewhere. */
export const numberingSystemOf = (formatLocale: string): 'mymr' | 'latn' =>
  formatLocale.startsWith('my') ? 'mymr' : 'latn';

/** Whole numbers (counts, page numbers) in the interface language's digits. */
export const formatCount = (value: number, formatLocale: string): string =>
  new Intl.NumberFormat(formatLocale, {
    numberingSystem: numberingSystemOf(formatLocale),
  }).format(value);

/** "427 pages" / "၄၂၇ မျက်နှာ": the count in the interface language's digits in a one/other template. */
export const formatPages = (
  pages: number,
  formatLocale: string,
  templates: { one: string; other: string },
): string =>
  (isSingular(pages, formatLocale) ? templates.one : templates.other).replace(
    '{count}',
    formatCount(pages, formatLocale),
  );

/** File size in Latin digits in every language, decimal units (1 MB = 1,000,000 bytes). */
export function formatSize(bytes: number, formatLocale: string): string {
  const [unit, divisor] =
    bytes >= 1e9
      ? (['gigabyte', 1e9] as const)
      : bytes >= 1e6
        ? (['megabyte', 1e6] as const)
        : (['kilobyte', 1e3] as const);
  return new Intl.NumberFormat(formatLocale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    numberingSystem: 'latn',
    maximumFractionDigits: unit === 'kilobyte' ? 0 : 1,
  }).format(bytes / divisor);
}
