#!/usr/bin/env node
// Adds PDF page counts to the committed library manifest. Needs no AWS access.
// Usage: npm run library:pages -- <counts.json> [more.json ...]
// Each file is a JSON array of { id, sizeBytes, pages }, for example the books.json that the
// text-only extraction run writes (docs/book-search.md). A count is used only when the book's
// id and size in the manifest match, so a replaced PDF is never given its old count.
import { readFileSync, writeFileSync } from 'node:fs';
import { withPages } from '../apps/web/src/lib/library-index.ts';
import { libraryFileSchema } from '../apps/web/src/lib/schemas.ts';

const manifestFile = new URL(
  '../apps/web/src/library/manifest.json',
  import.meta.url,
);
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error(
    'Usage: npm run library:pages -- <counts.json> [more.json ...]',
  );
  process.exit(1);
}
const counts = new Map();
for (const file of files)
  for (const entry of JSON.parse(readFileSync(file, 'utf8')))
    if (Number.isInteger(entry.pages) && entry.pages > 0 && !entry.error)
      counts.set(entry.id, entry);

const records = libraryFileSchema
  .array()
  .parse(JSON.parse(readFileSync(manifestFile, 'utf8')));
let added = 0;
let changed = 0;
let stale = 0;
const next = records.map((record) => {
  const entry = counts.get(record.id);
  if (!entry) return record;
  if (entry.sizeBytes !== record.sizeBytes) {
    stale++;
    return record;
  }
  if (record.pages === undefined) added++;
  else if (record.pages !== entry.pages) changed++;
  else return record;
  return withPages(record, entry.pages);
});
writeFileSync(manifestFile, `${JSON.stringify(next, null, 2)}\n`);
console.error(
  `${added} added, ${changed} changed, ${stale} skipped (size differs),` +
    ` ${next.filter((r) => !r.pages).length} still without a count`,
);
