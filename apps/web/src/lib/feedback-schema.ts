/** Shared by the dialog and Lambda. Never accept a delivery route from the browser. */
export const feedbackTypes = {
  post: ['typo', 'content', 'translation', 'other'],
  class: ['time', 'zoom', 'language', 'retreat', 'other'],
  library: ['broken', 'title', 'other'],
  general: ['suggestion', 'website', 'other'],
} as const;
export type FeedbackContext = keyof typeof feedbackTypes;
export type FeedbackType = (typeof feedbackTypes)[FeedbackContext][number];
export interface FeedbackReport {
  ctx: FeedbackContext;
  type: FeedbackType;
  message: string;
  email: string;
  page: string;
  item: string;
  lang: string;
  locale: 'en' | 'my';
  hp: string;
  t: number;
}
export const isFeedbackContext = (value: string): value is FeedbackContext =>
  Object.hasOwn(feedbackTypes, value);

export function feedbackRoute(ctx: FeedbackContext, type: string) {
  if (ctx === 'class') return 'schedule';
  if (ctx === 'post' || (ctx === 'library' && type === 'title'))
    return 'content';
  return 'site';
}

const bounded = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const optionalText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** A canonical path only: never send the reader's search, fragment or a full URL. */
export function isFeedbackPage(value: unknown): value is string {
  return bounded(value, 200) && /^\/(en|my)\/(?:[a-z0-9_-]+\/)*$/.test(value);
}

function validOptionalFields(v: Record<string, unknown>): boolean {
  const email = v.email ?? '';
  const item = v.item ?? '';
  const lang = v.lang ?? '';
  return (
    bounded(email, 254) &&
    (email === '' || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) &&
    bounded(item, 80) &&
    (item === '' || /^[a-z0-9._-]+$/.test(item)) &&
    bounded(lang, 7) &&
    (lang === '' ||
      (v.ctx === 'post' && ['my', 'en', 'zh-Hans'].includes(lang)))
  );
}

/** Explicit construction drops unknown fields, including any forged route or subject. */
export function parseFeedback(value: unknown): FeedbackReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.ctx !== 'string' || !isFeedbackContext(v.ctx)) return null;
  if (
    typeof v.type !== 'string' ||
    !(feedbackTypes[v.ctx] as readonly string[]).includes(v.type)
  )
    return null;
  if (
    !bounded(v.message, 2000) ||
    !v.message.trim() ||
    v.message.includes('\0')
  )
    return null;
  if (!isFeedbackPage(v.page) || (v.locale !== 'en' && v.locale !== 'my'))
    return null;
  if (
    !bounded(v.hp, 2000) ||
    typeof v.t !== 'number' ||
    !Number.isFinite(v.t) ||
    v.t < 0
  )
    return null;
  if (!validOptionalFields(v)) return null;
  return {
    ctx: v.ctx,
    type: v.type as FeedbackType,
    message: v.message.trim(),
    email: optionalText(v.email),
    page: v.page,
    item: optionalText(v.item),
    lang: optionalText(v.lang),
    locale: v.locale,
    hp: v.hp,
    t: v.t,
  };
}
