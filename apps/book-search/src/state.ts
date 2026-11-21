import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  truncate,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pageRecordSchema, type PageRecord } from './record.ts';

export const statePath = (stateDir: string, bookId: string): string =>
  path.join(stateDir, `${bookId}.jsonl`);

/**
 * Reads a book's page records. A last line that was cut off by an interrupted run (no newline
 * after it, and not valid) is removed from the file, so the next append starts on a clean line.
 * A bad line anywhere else is an error: the file is not touched.
 */
export async function loadState(file: string): Promise<PageRecord[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  const parts = text.split('\n');
  const tail = parts.pop() ?? '';
  const parse = (line: string): PageRecord =>
    pageRecordSchema.parse(JSON.parse(line));
  const records = parts.flatMap((line, i) => {
    if (line === '') return [];
    try {
      return [parse(line)];
    } catch (error) {
      throw new Error(
        `${file} line ${i + 1} is not a valid page record: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  });
  if (tail !== '') {
    try {
      records.push(parse(tail));
      await appendFile(file, '\n');
    } catch {
      await truncate(file, Buffer.byteLength(text) - Buffer.byteLength(tail));
    }
  }
  return records;
}

export async function appendRecord(
  file: string,
  record: PageRecord,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(pageRecordSchema.parse(record))}\n`);
}

/** Replaces the file with exactly these records, through a temporary file and a rename. */
export async function rewriteState(
  file: string,
  records: PageRecord[],
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const body = records
    .map((record) => `${JSON.stringify(pageRecordSchema.parse(record))}\n`)
    .join('');
  await writeFile(`${file}.tmp`, body);
  await rename(`${file}.tmp`, file);
}

export const resetState = (file: string): Promise<void> =>
  rm(file, { force: true });
