import { isLocale, type Locale } from './locales';
// Add Phase 1 page IDs here when their routes exist; never link to unbuilt pages.
export const pagePaths = {
  home: '',
  about: 'about/',
  privacy: 'privacy/',
  settings: 'settings/',
  classes: 'classes/',
  studyGroups: 'study-groups/',
  retreats: 'classes/retreats/',
  teachers: 'classes/sayadaws/',
  zoomHelp: 'zoom-help/',
  library: 'dhamma-library/',
  studyApps: 'dhamma-library/apps/',
  digitalTexts: 'dhamma-library/digital-texts/',
  posts: 'dhamma-posts/',
  donate: 'donate/',
} as const;
export type PageId = keyof typeof pagePaths;
export function route(locale: Locale, page: PageId = 'home'): string {
  return `/${locale}/${pagePaths[page]}`;
}
/** Static folder page; page 1 has no page segment, later pages are .../2/, .../3/. */
export function folderRoute(locale: Locale, id: string, page = 1): string {
  return `/${locale}/dhamma-library/folders/${id}/${page > 1 ? `${page}/` : ''}`;
}
/** Retreat detail page. */
export function retreatRoute(locale: Locale, id: string): string {
  return `/${locale}/classes/retreats/${id}/`;
}
/** Teacher bio page. */
export function teacherRoute(locale: Locale, id: string): string {
  return `/${locale}/classes/sayadaws/${id}/`;
}
/** Dhamma post page; the id is the file name without .md (YYYY-MM-DD-slug). */
export function postRoute(locale: Locale, id: string): string {
  return `/${locale}/dhamma-posts/${id}/`;
}
/** Posts with one tag. */
export function postTagRoute(locale: Locale, tag: string): string {
  return `/${locale}/dhamma-posts/tags/${tag}/`;
}
/**
 * One page of a post listing (all posts, or one tag): …/, …/page/2/, …/oldest/, …/oldest/page/2/.
 * Page 1 has no page segment.
 */
export function postListRoute(
  locale: Locale,
  {
    tag,
    sort = 'newest',
    page = 1,
  }: { tag?: string; sort?: 'newest' | 'oldest'; page?: number },
): string {
  const base = tag ? postTagRoute(locale, tag) : `/${locale}/dhamma-posts/`;
  return `${base}${sort === 'oldest' ? 'oldest/' : ''}${page > 1 ? `page/${page}/` : ''}`;
}
export function switchLocale(url: URL, locale: Locale): string {
  const parts = url.pathname.split('/');
  if (parts[1] && isLocale(parts[1])) parts[1] = locale;
  else return route(locale) + url.search + url.hash;
  return parts.join('/') + url.search + url.hash;
}
/** localStorage key for the language the reader chose; the root page opens it (rootRedirectScript). */
export const localePreferenceKey = 'winmetta.locale';
export function readLocalePreference(): Locale | undefined {
  try {
    const value = window.localStorage.getItem(localePreferenceKey);
    return value && isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
export function saveLocalePreference(locale: Locale): void {
  try {
    window.localStorage.setItem(localePreferenceKey, locale);
  } catch {
    /* Preference storage is optional. */
  }
}
/** Returns false when the browser blocks storage, so the caller can say nothing was cleared. */
export function clearLocalePreference(): boolean {
  try {
    window.localStorage.removeItem(localePreferenceKey);
    return true;
  } catch {
    return false;
  }
}
/**
 * Inline script for the root language chooser's <head>: a saved language sends the reader to that
 * language's home page before the chooser paints. `replace` keeps the chooser out of the Back
 * history; the query and fragment are kept. Only the root runs it, so a direct link to any other
 * page is never redirected. It cannot import anything (it is inlined), so it takes its inputs.
 */
export function rootRedirectScript(
  codes: readonly string[],
  key = localePreferenceKey,
): string {
  return `(function(){try{var l=localStorage.getItem(${JSON.stringify(key)});if(${JSON.stringify(codes)}.indexOf(l)>-1)location.replace('/'+l+'/'+location.search+location.hash)}catch(e){}})()`;
}
