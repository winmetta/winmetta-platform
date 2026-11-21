import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from '../test/helpers.ts';
import type { PageRecord } from './record.ts';
import { appendRecord, loadState } from './state.ts';

const record = (page: number): PageRecord => ({
  v: 1,
  bookId: 'aaaaaaaaaaaa',
  key: 'k.pdf',
  sha256: 'a'.repeat(64),
  page,
  method: 'text',
  engine: 'pdftotext 1',
  extractorVersion: 1,
  status: 'ok',
  confidence: null,
  reasons: [],
  passages: [{ ordinal: 1, script: 'latn', text: `page ${page}` }],
  extractedAt: '2026-11-20T21:00:00.000Z',
});

describe('state store', () => {
  it('is empty when the file does not exist', async () => {
    expect(await loadState(path.join(await tempDir(), 'none.jsonl'))).toEqual(
      [],
    );
  });
  it('appends one line per page and reads them back in order', async () => {
    const file = path.join(await tempDir(), 'state', 'b.jsonl');
    await appendRecord(file, record(1));
    await appendRecord(file, record(2));
    expect((await loadState(file)).map((r) => r.page)).toEqual([1, 2]);
  });
  it('removes a last line cut off by an interrupted run, so appends stay clean', async () => {
    const file = path.join(await tempDir(), 'b.jsonl');
    await appendRecord(file, record(1));
    await appendFile(file, '{"v":1,"bookId":"aaa');
    expect((await loadState(file)).map((r) => r.page)).toEqual([1]);
    await appendRecord(file, record(2));
    expect((await loadState(file)).map((r) => r.page)).toEqual([1, 2]);
    expect(
      (await readFile(file, 'utf8')).split('\n').filter(Boolean),
    ).toHaveLength(2);
  });
  it('keeps a complete last line that only lacks its newline', async () => {
    const file = path.join(await tempDir(), 'b.jsonl');
    await writeFile(file, JSON.stringify(record(1)));
    expect(await loadState(file)).toHaveLength(1);
    await appendRecord(file, record(2));
    expect((await loadState(file)).map((r) => r.page)).toEqual([1, 2]);
  });
  it('fails on a bad line in the middle without changing the file', async () => {
    const file = path.join(await tempDir(), 'b.jsonl');
    const content = `${JSON.stringify(record(1))}\nnot json\n${JSON.stringify(record(3))}\n`;
    await writeFile(file, content);
    await expect(loadState(file)).rejects.toThrow(/line 2/);
    expect(await readFile(file, 'utf8')).toBe(content);
  });
});
