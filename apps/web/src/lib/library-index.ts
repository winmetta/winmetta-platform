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
  const tagPath = segments.map((segment) =>
    cleanDisplay(cleanDisplay(segment).replace(numberPrefix, '')),
  );
  const seen = new Set<string>();
  const tags = tagPath.filter((tag) => {
    const identity = normalizeSearch(tag);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  return { tagPath, tags, sortPath: segments, filename };
}
/** "Name (Note).pdf" becomes title "Name" and titleNote "Note". */
export function titleFromFilename(filename: string): {
  title: string;
  titleNote?: string;
} {
  const base = cleanDisplay(filename.replace(/\.pdf$/i, ''));
  const match = /^(.*\S)\s*\(([^()]+)\)$/.exec(base);
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
