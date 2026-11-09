/**
 * Privacy rules for analytics events (docs/analytics.md §3 and §4). Pure functions, so they are
 * unit tested; analytics-client.ts wires them to the Umami tracker. Nothing here may carry free
 * text: counts and times are bucketed, labels come from fixed lists, and the requested path of a
 * missing page is never sent.
 */
import { isLocale } from '../i18n/locales';

/** First path segments that are real sections (after the locale). Anything else is "other". */
export const knownSections = [
  'about',
  'privacy',
  'classes',
  'study-groups',
  'zoom-help',
  'dhamma-library',
  'dhamma-posts',
] as const;

export type CountBucket = '0' | '1-5' | '6-20' | 'more';
export type PositionBucket = '1' | '2-3' | '4-10' | 'more';
export type TimeBucket = 'under-1s' | '1-3s' | '3-10s' | 'over-10s';

export function bucketCount(n: number): CountBucket {
  if (n <= 0) return '0';
  if (n <= 5) return '1-5';
  if (n <= 20) return '6-20';
  return 'more';
}

/** Position of a clicked result, 1-based. */
export function bucketPosition(position: number): PositionBucket {
  if (position <= 1) return '1';
  if (position <= 3) return '2-3';
  if (position <= 10) return '4-10';
  return 'more';
}

export function bucketTime(ms: number): TimeBucket {
  if (ms < 1000) return 'under-1s';
  if (ms < 3000) return '1-3s';
  if (ms < 10000) return '3-10s';
  return 'over-10s';
}

/** Which script a search query is written in. Only this label is sent, never the text. */
export function scriptOf(query: string): 'my' | 'latin' | 'mixed' | 'other' {
  const burmese = /[က-႟ꩠ-ꩿꧠ-꧿]/u.test(query);
  const latin = /\p{Script=Latin}/u.test(query);
  if (burmese && latin) return 'mixed';
  if (burmese) return 'my';
  if (latin) return 'latin';
  return 'other';
}

/** `/en/classes/x/` becomes `classes`; an unknown or typed segment becomes `other`. */
export function sectionOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0] && isLocale(parts[0]) ? parts[1] : parts[0];
  return (knownSections as readonly string[]).includes(first ?? '')
    ? (first as string)
    : 'other';
}

/**
 * Referrer rule (analytics.md §3, §9 item 15). An outside referrer keeps only its origin (no path
 * or query, which can hold search text). A referrer on this site keeps only `/<locale>/<section>/`
 * when both are known; anything else (a mistyped path, a 404) collapses to `/`.
 */
export function sanitizeReferrer(referrer: string, siteOrigin: string): string {
  if (!referrer) return '';
  let url: URL;
  try {
    url = new URL(referrer, siteOrigin);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.origin !== new URL(siteOrigin).origin) return `${url.origin}/`;
  const [locale, section] = url.pathname.split('/').filter(Boolean);
  if (locale && isLocale(locale)) {
    if (!section) return `/${locale}/`;
    if ((knownSections as readonly string[]).includes(section))
      return `/${locale}/${section}/`;
  }
  return '/';
}

/** Path reported for a page view: no query string or fragment; the 404 page is one constant path. */
export function reportedPath(pathname: string, notFound: boolean): string {
  return notFound ? '/404/' : pathname;
}

export interface TrackerPayload {
  url?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * The tracker's before-send hook. Removes what the plan says is not kept (screen size) and
 * sanitizes the address and referrer. `siteOrigin` is the page's own origin.
 */
export function cleanPayload(
  payload: TrackerPayload,
  siteOrigin: string,
  notFound: boolean,
): TrackerPayload {
  const next: TrackerPayload = { ...payload };
  delete next.screen;
  let pathname = '/';
  try {
    pathname = new URL(payload.url ?? '/', siteOrigin).pathname;
  } catch {
    // keep "/"
  }
  next.url = reportedPath(pathname, notFound);
  next.referrer = sanitizeReferrer(payload.referrer ?? '', siteOrigin);
  return next;
}

/** True when the browser asks not to be tracked. The tracker script is then not even loaded. */
export function doNotTrack(env: {
  doNotTrack?: string | null;
  msDoNotTrack?: string | null;
  windowDoNotTrack?: string | null;
}): boolean {
  return [env.doNotTrack, env.msDoNotTrack, env.windowDoNotTrack].some(
    (v) => v === '1' || v === 'yes',
  );
}

type Props = Record<string, string | number | boolean>;
interface UmamiGlobal {
  track: (name: string, data?: Props) => unknown;
}
interface QueuedEvent {
  name: string;
  data?: Props;
}
type AnalyticsGlobal = {
  umami?: UmamiGlobal;
  /** Created by analytics-client.ts while the tracker script is loading; absent when analytics is off. */
  winmettaAnalyticsQueue?: QueuedEvent[];
};

/**
 * Sends one event. A silent no-op when analytics is off (dev, tests, Do Not Track). While the
 * tracker script is still loading, the event waits in a queue that analytics-client.ts flushes.
 */
export function track(name: string, data?: Props): void {
  const g = globalThis as AnalyticsGlobal;
  try {
    if (g.umami) g.umami.track(name, data);
    else g.winmettaAnalyticsQueue?.push({ name, data });
  } catch {
    // analytics must never break the page
  }
}

/** Sends the events that waited for the tracker to load. */
export function flushQueue(): void {
  const g = globalThis as AnalyticsGlobal;
  const queue = g.winmettaAnalyticsQueue ?? [];
  g.winmettaAnalyticsQueue = undefined;
  for (const event of queue) track(event.name, event.data);
}

/**
 * Sends an event only once the visitor stops changing its input for `delay` ms, so typing a
 * query counts as one search, not one per keystroke. Returns a function that cancels it, for
 * the next keystroke or when the component goes away.
 */
export function trackSettled(
  name: string,
  data: Props,
  delay = 1500,
): () => void {
  const timer = setTimeout(() => track(name, data), delay);
  return () => clearTimeout(timer);
}
