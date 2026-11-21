import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { workDir, workPaths } from './config.ts';
import { openIndex } from './api/search.ts';
import { run } from './tools.ts';

export interface Upload {
  file: string;
  key: string;
}

/** The files of one release and where they go: the database and its checksum, never overwritten. */
export function planPublish(file: string): Upload[] {
  const name = path.basename(file);
  if (!/^library-search-[\w-]+\.sqlite$/.test(name))
    throw new Error(
      `${name} is not a built index (library-search-<version>.sqlite)`,
    );
  return [file, `${file}.sha256`].map((f) => ({
    file: f,
    key: `releases/${path.basename(f)}`,
  }));
}

async function newestIndex(): Promise<string> {
  const dist = workPaths(workDir()).dist;
  const names = (await readdir(dist).catch(() => [] as string[]))
    .filter((name) => name.endsWith('.sqlite'))
    .sort();
  const newest = names.at(-1);
  if (!newest) throw new Error(`No built index in ${dist}`);
  return path.join(dist, newest);
}

const usage = `Usage: npm run book-search:publish -- --bucket <name> [--file <index.sqlite>] [--yes]

Uploads a built index and its .sha256 to s3://<bucket>/releases/ with a conditional write, so an
existing release is never overwritten. Without --yes it only shows what it would do. It uses the
AWS CLI and whatever AWS profile and region your shell has set; check them first. Operating
steps for the real account are in the private operations runbook.
`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      bucket: { type: 'string' },
      file: { type: 'string' },
      yes: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help || !values.bucket) {
    console.log(usage);
    return values.help ? 0 : 1;
  }
  const file = path.resolve(values.file ?? (await newestIndex()));
  const index = openIndex(file, { verifySha: true });
  index.db.close();
  const uploads = planPublish(file);
  for (const upload of uploads) {
    const size = (await stat(upload.file)).size;
    console.log(
      `${values.yes ? 'Uploading' : 'Would upload'} ${upload.file} (${size} bytes) to s3://${values.bucket}/${upload.key}`,
    );
    if (!values.yes) continue;
    await run('aws', [
      's3api',
      'put-object',
      '--bucket',
      values.bucket,
      '--key',
      upload.key,
      '--body',
      upload.file,
      '--if-none-match',
      '*',
      '--output',
      'json',
    ]);
  }
  console.log(
    values.yes
      ? `Published index ${index.indexVersion}.`
      : 'Dry run: nothing was uploaded. Add --yes to upload.',
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
