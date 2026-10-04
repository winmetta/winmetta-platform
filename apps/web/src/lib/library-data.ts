// Build-time only (imports node:crypto): turns the committed manifest into the two static
// files the browser downloads lazily on first search, and a content hash for their URLs.
import { createHash } from 'node:crypto';
import { files } from './library-catalog';
import { LibrarySearch, type SearchRecord } from './library-search';

// Records stay in library order (the manifest order): it is the search tie-breaker.
const records: SearchRecord[] = files.map((file) => ({
  id: file.id,
  key: file.key,
  title: file.title,
  ...(file.titleNote ? { titleNote: file.titleNote } : {}),
  tags: file.tags,
  language: file.language,
  sizeBytes: file.sizeBytes,
}));
const recordsJson = JSON.stringify(records);
const indexJson = LibrarySearch.build(records).serialize();
// A content hash in the URL lets the CDN cache both files forever.
const version = createHash('sha256')
  .update(recordsJson)
  .update(indexJson)
  .digest('hex')
  .slice(0, 12);

export const libraryData = { recordsJson, indexJson, version };
