import { isLocale, type Locale } from './locales';
// Add Phase 1 page IDs here when their routes exist; never link to unbuilt pages.
export const pagePaths = {
  home: '',
  about: 'about/',
  privacy: 'privacy/',
  classes: 'classes/',
  studyGroups: 'study-groups/',
  retreats: 'classes/retreats/',
  teachers: 'classes/sayadaws/',
  zoomHelp: 'zoom-help/',
  library: 'dhamma-library/',
  posts: 'dhamma-posts/',
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
export function saveLocalePreference(locale: Locale): void {
  try {
    window.localStorage.setItem('winmetta.locale', locale);
  } catch {
    /* Preference storage is optional. */
  }
}
