// Search and filter state for the retreat archive. Pure helpers shared by the island and its tests.
import { normalizeSearch } from './normalize';

export interface RetreatItem {
  id: string;
  href: string;
  title: string;
  dates: string;
  year: number;
  format: 'online' | 'onsite' | 'hybrid';
  days: number;
  teachers: { id: string; name: string }[];
  venue: string;
  /** Everything a visitor might type, in both languages, normalized once at build time. */
  haystack: string;
}
export interface RetreatState {
  q: string;
  year: string;
  format: string;
  days: string;
  teacher: string;
}
export const emptyState: RetreatState = {
  q: '',
  year: '',
  format: '',
  days: '',
  teacher: '',
};
const keys = ['q', 'year', 'format', 'days', 'teacher'] as const;

export function readState(search: string): RetreatState {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    keys.map((key) => [key, params.get(key) ?? '']),
  ) as unknown as RetreatState;
}

export function writeState(
  state: RetreatState,
  location: { pathname: string; hash: string },
): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = key === 'q' ? state.q.trim() : state[key];
    if (value) params.set(key, state[key]);
  }
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
}

export const isActive = (state: RetreatState): boolean =>
  keys.some((key) => (key === 'q' ? state.q.trim() : state[key]) !== '');

/** Every word typed must appear somewhere in the retreat's text. */
export function filterRetreats(
  items: RetreatItem[],
  state: RetreatState,
): RetreatItem[] {
  const words = normalizeSearch(state.q).split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      words.every((word) => item.haystack.includes(word)) &&
      (!state.year || String(item.year) === state.year) &&
      (!state.format || item.format === state.format) &&
      (!state.days || String(item.days) === state.days) &&
      (!state.teacher || item.teachers.some((t) => t.id === state.teacher)),
  );
}
