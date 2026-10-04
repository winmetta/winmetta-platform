#!/usr/bin/env node
// Lists the Dhamma Library S3 bucket (read-only) and writes the committed manifest.
// Needs a read-only AWS profile, e.g. `aws sso login --profile winmetta-ro`.
//   AWS_PROFILE=winmetta-ro npm run library:manifest
// Overrides (title, titleNote, language, extra tags, hide) live in overrides.json by S3 key.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  compareLibraryOrder,
  duplicateIdentity,
  fileUrl,
  recordFromObject,
} from '../apps/web/src/lib/library-index.ts';
import { libraryFileSchema } from '../apps/web/src/lib/schemas.ts';
import { fixZawgyiTitle, hasZawgyiMarker } from '../apps/web/src/lib/zawgyi.ts';

// myanmar-tools is pinned to 1.1.3: 1.2.0 on npm ships unbuilt sources and cannot be required.
const { ZawgyiDetector, ZawgyiConverter } = createRequire(import.meta.url)(
  'myanmar-tools',
);
const detector = new ZawgyiDetector();
const converter = new ZawgyiConverter();

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
const zawgyi = { converted: [], suspicious: [], ambiguous: [], tags: [] };
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
  // Legacy Zawgyi filenames: convert only when a marker and the detector agree (see zawgyi.ts).
  const original = { title: record.title, titleNote: record.titleNote };
  const zg = fixZawgyiTitle(record, detector, converter);
  if (zg.verdict === 'converted') {
    record.title = zg.title;
    if (zg.titleNote) record.titleNote = zg.titleNote;
    zawgyi.converted.push({
      key: object.Key,
      probability: Number(zg.probability.toFixed(3)),
      original,
      converted: { title: record.title, titleNote: record.titleNote },
    });
  } else if (zg.verdict !== 'unicode') {
    zawgyi[zg.verdict].push(object.Key);
  }
  for (const tag of record.tagPath)
    if (hasZawgyiMarker(tag)) zawgyi.tags.push(`${object.Key}: ${tag}`);
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
  fileUrl('https://example.invalid', record.key); // throws if the key does not round-trip
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
// Folder sequence (1-12 Burmese, then 13-18), then title; raw key order would not keep it.
kept.sort(compareLibraryOrder);

// Every automatic conversion is listed for review by a Burmese speaker. Wrong ones are fixed
// by setting title/titleNote for that key in overrides.json (overrides win on the next run).
zawgyi.converted.sort((a, b) => compare(a.key, b.key));
for (const entry of zawgyi.converted)
  entry.overridden = Boolean(overrides[entry.key]?.title);
writeFileSync(
  new URL('zawgyi-review.json', dir),
  `${JSON.stringify(zawgyi.converted, null, 2)}\n`,
);
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
zawgyi.suspicious = zawgyi.suspicious.filter((key) => !overrides[key]); // already corrected by a person
console.error(
  `Zawgyi: ${zawgyi.converted.length} converted (review zawgyi-review.json),` +
    ` ${zawgyi.suspicious.length} suspicious, ${zawgyi.ambiguous.length} ambiguous (left unchanged)`,
);
for (const key of zawgyi.suspicious) console.error(`zawgyi-suspicious: ${key}`);
for (const line of zawgyi.tags) console.error(`zawgyi-folder-name: ${line}`);
