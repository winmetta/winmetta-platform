#!/usr/bin/env node
// Lists the Dhamma Library S3 bucket (read-only) and writes the committed manifest.
// Needs a read-only AWS profile, e.g. `aws sso login --profile winmetta-ro`.
//   AWS_PROFILE=winmetta-ro npm run library:manifest
// Overrides (title, titleNote, language, extra tags, hide) live in overrides.json by S3 key.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  duplicateIdentity,
  recordFromObject,
} from '../apps/web/src/lib/library-index.ts';
import { libraryFileSchema } from '../apps/web/src/lib/schemas.ts';

const bucket = process.env.LIBRARY_BUCKET ?? 'dhamma-library';
const dir = new URL('../apps/web/src/library/', import.meta.url);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const listing = JSON.parse(
  execFileSync(
    'aws',
    ['s3api', 'list-objects-v2', '--bucket', bucket, '--output', 'json'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  ),
);
const objects = listing.Contents ?? [];
const overrides = JSON.parse(readFileSync(new URL('overrides.json', dir)));

const skipped = { empty: 0, notPdf: [] };
const records = [];
for (const object of objects) {
  if (object.Size === 0) {
    skipped.empty++;
    continue;
  }
  if (!/\.pdf$/i.test(object.Key)) {
    skipped.notPdf.push(object.Key);
    continue;
  }
  const id = createHash('sha256').update(object.Key).digest('hex').slice(0, 12);
  const record = recordFromObject(object, id);
  const fix = overrides[object.Key];
  if (fix?.hide) continue;
  if (fix) {
    const { title, titleNote, language, tags } = fix;
    Object.assign(
      record,
      Object.fromEntries(
        Object.entries({ title, titleNote, language }).filter(
          ([, v]) => v !== undefined,
        ),
      ),
    );
    if (tags) record.tags = [...new Set([...record.tags, ...tags])];
  }
  records.push(libraryFileSchema.parse(record));
}

// The same file stored under differently spelled folders is indexed once, keeping
// the copy in the folder with more files.
const folderSize = new Map();
for (const r of records) {
  const folder = r.key.slice(0, r.key.lastIndexOf('/'));
  folderSize.set(folder, (folderSize.get(folder) ?? 0) + 1);
}
const folderOf = (r) => r.key.slice(0, r.key.lastIndexOf('/'));
const groups = new Map();
for (const r of records) {
  const identity = duplicateIdentity(r);
  groups.set(identity, [...(groups.get(identity) ?? []), r]);
}
const duplicates = [];
const kept = [];
for (const group of groups.values()) {
  group.sort(
    (a, b) =>
      folderSize.get(folderOf(b)) - folderSize.get(folderOf(a)) ||
      compare(a.key, b.key),
  );
  kept.push(group[0]);
  for (const dropped of group.slice(1))
    duplicates.push([dropped.key, group[0].key]);
}
kept.sort((a, b) => compare(a.key, b.key));

writeFileSync(
  new URL('manifest.json', dir),
  `${JSON.stringify(kept, null, 2)}\n`,
);
console.error(
  `${objects.length} objects -> ${kept.length} records` +
    ` (${skipped.empty} empty, ${skipped.notPdf.length} non-PDF, ${duplicates.length} duplicates)`,
);
for (const key of skipped.notPdf) console.error(`non-PDF: ${key}`);
for (const [dropped, keptKey] of duplicates)
  console.error(`duplicate: ${dropped}\n   kept: ${keptKey}`);
