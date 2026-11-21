import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from '../test/helpers.ts';
import {
  ensureModels,
  gitBlobId,
  MODELS,
  verifyModel,
  type Model,
} from './models.ts';

describe('gitBlobId', () => {
  it('matches `git hash-object`', () => {
    expect(gitBlobId(Buffer.alloc(0))).toBe(
      'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
    );
    expect(gitBlobId(Buffer.from('hello\n'))).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a',
    );
  });
});

describe('models', () => {
  const data = Buffer.from('fake model');
  const model: Model = {
    lang: 'xyz',
    size: data.length,
    blob: gitBlobId(data),
  };

  it('pins both languages the indexer reads', () => {
    expect(MODELS.map((m) => m.lang).sort()).toEqual(['eng', 'mya']);
  });
  it('verifyModel reports missing, mismatch and ok', async () => {
    const dir = await tempDir();
    expect(await verifyModel(dir, model)).toBe('missing');
    await writeFile(path.join(dir, 'xyz.traineddata'), 'something else');
    expect(await verifyModel(dir, model)).toBe('mismatch');
    await writeFile(path.join(dir, 'xyz.traineddata'), data);
    expect(await verifyModel(dir, model)).toBe('ok');
  });
  it('ensureModels refuses and keeps nothing when the download does not match', async () => {
    const dir = path.join(await tempDir(), 'tessdata');
    const wrong = async () => new Response('not the pinned model');
    await expect(
      ensureModels(dir, () => {}, wrong as typeof fetch),
    ).rejects.toThrow(/pinned hash/);
    await mkdir(dir, { recursive: true });
    expect(await verifyModel(dir, MODELS[0]!)).toBe('missing');
  });
  it('ensureModels does not download files that are already right', async () => {
    const dir = await tempDir();
    for (const m of MODELS)
      await writeFile(path.join(dir, `${m.lang}.traineddata`), 'x');
    // The files are wrong, so a download is attempted; a failing fetch proves it was.
    const failing = async () => new Response('', { status: 404 });
    await expect(
      ensureModels(dir, () => {}, failing as typeof fetch),
    ).rejects.toThrow(/HTTP 404/);
    expect(await readFile(path.join(dir, 'mya.traineddata'), 'utf8')).toBe('x');
  });
});
