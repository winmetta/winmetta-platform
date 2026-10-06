import type { LibraryFile } from './schemas.ts';
import { normalizeSearch } from './normalize.ts';
// Leading folder numbers: Burmese or ASCII digits, then "။" or ".".
const numberPrefix = /^[0-9၀-၉]+[။.]\s*/;
// Display text: NFC, no zero-width characters, collapsed spaces.
export const cleanDisplay = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/[\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** Display name of one folder segment: number prefix and zero-width characters removed. */
export const folderName = (segment: string): string =>
  cleanDisplay(cleanDisplay(segment).replace(numberPrefix, ''));
export interface KeyParts {
  tagPath: string[];
  tags: string[];
  sortPath: string[];
  filename: string;
}
/** Folder path of an S3 key as tags: number prefix removed, same-named folders share a tag. */
export function partsFromKey(key: string): KeyParts {
  const segments = key.split('/');
  const filename = segments.pop() ?? '';
  const tagPath = segments.map(folderName);
  const seen = new Set<string>();
  const tags = tagPath.filter((tag) => {
    const identity = normalizeSearch(tag);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  return { tagPath, tags, sortPath: segments, filename };
}
/**
 * Filenames often have a doubled "))" or a ")" with no "(" (both unreadable in a title), or a
 * dangling "(" at the end. Drops every ")" that has no opening "(" and a trailing "(".
 */
function dropStrayParentheses(text: string): string {
  let depth = 0;
  let result = '';
  for (const char of text) {
    if (char === ')') {
      if (depth === 0) continue;
      depth--;
    } else if (char === '(') depth++;
    result += char;
  }
  return result.replace(/\s*\(\s*$/, '');
}
/** "Name (Note).pdf" becomes title "Name" and titleNote "Note"; an unclosed "(" is handled too. */
export function titleFromFilename(filename: string): {
  title: string;
  titleNote?: string;
} {
  const base = cleanDisplay(
    dropStrayParentheses(filename.replace(/\.pdf$/i, '')),
  );
  // The closing ")" is sometimes missing from the filename: "Name (Note.pdf" is Name + Note.
  const match = /^(.*\S)\s*\(([^()]+)\)?$/.exec(base);
  if (match?.[1] && match[2]) {
    return { title: match[1], titleNote: cleanDisplay(match[2]) };
  }
  return { title: base };
}
export const languageOf = (title: string): string =>
  /[က-႟]/.test(title) ? 'my' : 'en';
/** Public URL for an S3 key: every path segment encoded, key kept exact. */
export function fileUrl(base: string, key: string): string {
  const url = `${base.replace(/\/+$/, '')}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const roundTrip = decodeURIComponent(
    url.slice(base.replace(/\/+$/, '').length + 1),
  );
  if (roundTrip !== key) throw new Error(`Key does not round-trip: ${key}`);
  return url;
}
export interface S3Object {
  Key: string;
  Size: number;
  LastModified: string;
}
export function recordFromObject(object: S3Object, id: string): LibraryFile {
  const { tagPath, tags, filename } = partsFromKey(object.Key);
  const { title, titleNote } = titleFromFilename(filename);
  return {
    id,
    key: object.Key,
    title,
    ...(titleNote ? { titleNote } : {}),
    tags,
    tagPath,
    language: languageOf(title),
    sizeBytes: object.Size,
    format: 'pdf',
    lastModified: new Date(object.LastModified).toISOString(),
  };
}
/** Identity used to detect the same file stored under differently spelled folders. */
export const duplicateIdentity = (record: LibraryFile): string =>
  [
    ...record.tagPath.map(normalizeSearch),
    normalizeSearch(record.title),
    normalizeSearch(record.titleNote ?? ''),
    record.sizeBytes,
  ].join('/');

// Order text "naturally": digits (Burmese or ASCII) compare by value, so folder ၂ comes before
// ၁၀ and a number prefix sorts the same in either script.
const naturalText = (text: string): string =>
  normalizeSearch(text).replace(/\d+/g, (digits) => digits.padStart(10, '0'));
const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
/** Folder paths ("a/b") in folder sequence: numeric prefixes compare by value, per segment. */
export function compareFolderPath(a: string, b: string): number {
  const [sa, sb] = [
    a.split('/').map(naturalText),
    b.split('/').map(naturalText),
  ];
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    const order = compareText(sa[i] ?? '', sb[i] ?? '');
    if (order) return order;
  }
  return sa.length - sb.length;
}
/**
 * Library order: folder sequence (the numeric prefix of each folder, 1-12 Burmese then 13-18
 * English), then title, then note, then the raw key. Raw key order would put folders 13-18
 * first and 10-12 before 1-9. LibrarySearch uses this order as its final tie-breaker.
 */
export function compareLibraryOrder(a: LibraryFile, b: LibraryFile): number {
  const folders = (record: LibraryFile): string[] =>
    record.key.split('/').slice(0, -1).map(naturalText);
  const [fa, fb] = [folders(a), folders(b)];
  for (let i = 0; i < Math.min(fa.length, fb.length); i++) {
    const order = compareText(fa[i] ?? '', fb[i] ?? '');
    if (order) return order;
  }
  return (
    fa.length - fb.length ||
    compareText(naturalText(a.title), naturalText(b.title)) ||
    compareText(
      naturalText(a.titleNote ?? ''),
      naturalText(b.titleNote ?? ''),
    ) ||
    compareText(a.key, b.key)
  );
}
