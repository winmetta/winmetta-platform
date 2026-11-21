import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureBook, tempDir } from '../test/helpers.ts';
import { fetchBook } from './fetch.ts';

describe('fetchBook', () => {
  const body = Buffer.from('%PDF fake');
  const book = { ...fixtureBook(), sizeBytes: body.length };

  it('downloads from the encoded CDN address and checks the size', async () => {
    const dir = await tempDir();
    let requested = '';
    const fake = async (url: string | URL | Request) => {
      requested = String(url);
      return new Response(body);
    };
    const file = await fetchBook(book, {
      pdfsDir: dir,
      cdnBase: 'https://cdn.example/',
      log: () => {},
      fetchImpl: fake as typeof fetch,
    });
    expect(requested).toBe('https://cdn.example/folder/Fixture%20book.pdf');
    expect(file).toBe(path.join(dir, 'aaaaaaaaaaaa.pdf'));
    expect(await readFile(file)).toEqual(body);
  });
  it('keeps an existing file of the right size without downloading', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'aaaaaaaaaaaa.pdf'), body);
    const never = async () => {
      throw new Error('should not fetch');
    };
    await fetchBook(book, {
      pdfsDir: dir,
      cdnBase: 'https://cdn.example',
      log: () => {},
      fetchImpl: never as typeof fetch,
    });
  });
  it('rejects a wrong size and leaves no partial file', async () => {
    const dir = await tempDir();
    const fake = async () => new Response('short');
    await expect(
      fetchBook(book, {
        pdfsDir: dir,
        cdnBase: 'https://cdn.example',
        log: () => {},
        fetchImpl: fake as typeof fetch,
      }),
    ).rejects.toThrow(/manifest says/);
    await expect(
      readFile(path.join(dir, 'aaaaaaaaaaaa.pdf')),
    ).rejects.toThrow();
    await expect(
      readFile(path.join(dir, 'aaaaaaaaaaaa.pdf.part')),
    ).rejects.toThrow();
  });
  it('fails on an HTTP error', async () => {
    const fake = async () => new Response('', { status: 404 });
    await expect(
      fetchBook(book, {
        pdfsDir: await tempDir(),
        cdnBase: 'https://cdn.example',
        log: () => {},
        fetchImpl: fake as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
