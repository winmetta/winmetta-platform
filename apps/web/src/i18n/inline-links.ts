import type { Locale } from './locales';
import { pagePaths, route, type PageId } from './routes';

export type InlinePart =
  string | { label: string; href: string; external: boolean };

// `[label](target)` inside a message.
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function link(locale: Locale, label: string, target: string): InlinePart {
  if (target.startsWith('https://'))
    return { label, href: target, external: true };
  if (Object.hasOwn(pagePaths, target))
    return { label, href: route(locale, target as PageId), external: false };
  throw new Error(`Unknown link target "${target}"`);
}

/**
 * Splits a message into plain text and `[label](target)` links. A target is
 * a page id from `pagePaths` (a page on this site, in the same locale) or an
 * https URL. Any other target throws, so a typo fails the build.
 */
export function inlineLinks(locale: Locale, message: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of message.matchAll(LINK)) {
    const [whole, label = '', target = ''] = match;
    const start = match.index ?? 0;
    if (start > last) parts.push(message.slice(last, start));
    parts.push(link(locale, label, target));
    last = start + whole.length;
  }
  if (last < message.length) parts.push(message.slice(last));
  return parts;
}

/** A message's link targets, sorted, so every locale can be held to the same ones. */
export function linkTargetsOf(message: string): string {
  return [...message.matchAll(LINK)]
    .map((match) => match[2] ?? '')
    .sort()
    .join(',');
}
