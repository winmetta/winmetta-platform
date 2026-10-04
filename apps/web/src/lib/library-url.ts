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

/** File size in the interface locale's number format, decimal units (1 MB = 1,000,000 bytes). */
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
    maximumFractionDigits: unit === 'kilobyte' ? 0 : 1,
  }).format(bytes / divisor);
}
