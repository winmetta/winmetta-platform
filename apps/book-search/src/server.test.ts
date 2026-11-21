import { execFile } from 'node:child_process';
import type { Server } from 'node:http';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixtureIndex } from '../test/fixtureIndex.ts';
import { openIndex } from './api/search.ts';
import { createApiServer, listen } from './api/server.ts';
import { SearchApiError, createSearchClient } from './client.ts';

const run = promisify(execFile);
const cli = new URL('./search-cli.ts', import.meta.url).pathname;

// The contract tests use their own variable, never the CLI's BOOK_SEARCH_BASE_URL, so a shell set
// up for the CLI cannot point `npm test` at a deployed backend. Unset, they start the local
// server on a fixture index and also check the fixture's content.
const external = process.env['BOOK_SEARCH_TEST_BASE_URL'];

let server: Server | undefined;
let baseUrl = external ?? '';
const logs: string[] = [];

beforeAll(async () => {
  if (external) return;
  const { file } = await buildFixtureIndex();
  const index = openIndex(file);
  server = createApiServer({ index, cdnBase: 'https://cdn.example' }, (line) =>
    logs.push(line),
  );
  baseUrl = `http://127.0.0.1:${await listen(server, 0)}`;
});
afterAll(
  () =>
    new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    ),
);

const codeOf = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn();
  } catch (error) {
    if (error instanceof SearchApiError) return `${error.status} ${error.code}`;
    throw error;
  }
  return 'no error';
};

describe('API client (contract)', () => {
  const client = () => createSearchClient({ baseUrl });

  it('reports health in the contract shape', async () => {
    const health = await client().health();
    expect(health.books).toBeGreaterThan(0);
  });
  it('returns a valid response with at most `limit` results', async () => {
    const r = await client().search({ q: 'dhamma', limit: 2 });
    expect(r.results.length).toBeLessThanOrEqual(2);
    expect(r.query).toMatchObject({ lang: 'any', limit: 2, page: 1 });
  });
  it('maps contract errors to SearchApiError', async () => {
    expect(await codeOf(() => client().search({ q: '' }))).toBe(
      '400 query_missing',
    );
    expect(await codeOf(() => client().search({ q: 'x'.repeat(201) }))).toBe(
      '400 query_too_long',
    );
    expect(await codeOf(() => client().search({ q: 'abc', limit: 99 }))).toBe(
      '400 bad_param',
    );
  });
  it('ignores a trailing slash on the base URL', async () => {
    const health = await createSearchClient({
      baseUrl: `${baseUrl}/`,
    }).health();
    expect(health.books).toBeGreaterThan(0);
  });
  it('turns a non-JSON answer into invalid_response', async () => {
    const fake = (async () =>
      new Response('<html>', { status: 502 })) as typeof fetch;
    expect(
      await codeOf(() =>
        createSearchClient({ baseUrl: 'http://x', fetch: fake }).health(),
      ),
    ).toBe('502 invalid_response');
  });
  it('rejects a response that breaks the contract', async () => {
    const fake = (async () => Response.json({ v: 2 })) as typeof fetch;
    await expect(
      createSearchClient({ baseUrl: 'http://x', fetch: fake }).health(),
    ).rejects.toThrow();
  });
});

describe.skipIf(!!external)('local server with the fixture index', () => {
  it('finds a page through the client, with the PDF page link', async () => {
    const r = await createSearchClient({ baseUrl }).search({
      q: '"noble truths"',
    });
    expect(r.results.map((x) => [x.bookId, x.page])).toEqual([
      ['bbbbbbbbbbbb', 1],
    ]);
    expect(r.results[0]?.pdfUrl).toBe(
      'https://cdn.example/en/Book%20B.pdf#page=1',
    );
  });
  it('finds Burmese through the client', async () => {
    const r = await createSearchClient({ baseUrl }).search({
      q: 'ဓမ္မ ဒေသနာ',
      lang: 'my',
    });
    expect(r.results.map((x) => x.page)).toEqual([1]);
  });
  it('refuses a cross-site request and sends no CORS headers', async () => {
    const blocked = await fetch(`${baseUrl}/api/search?q=abc`, {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(blocked.status).toBe(403);
    const ok = await fetch(`${baseUrl}/api/search?q=abc`);
    expect(ok.headers.get('access-control-allow-origin')).toBeNull();
    expect(ok.headers.get('content-type')).toContain('application/json');
  });
  it('answers 404 and 405 for other paths and methods', async () => {
    expect((await fetch(`${baseUrl}/nope`)).status).toBe(404);
    expect(
      (await fetch(`${baseUrl}/api/search?q=abc`, { method: 'POST' })).status,
    ).toBe(405);
  });
  it('logs the path and status but never the query', async () => {
    await fetch(`${baseUrl}/api/search?q=secretwords`);
    expect(logs.some((line) => /GET \/api\/search 200 \d+ms/.test(line))).toBe(
      true,
    );
    expect(logs.join('\n')).not.toContain('secretwords');
  });
});

describe.skipIf(!!external)('CLI against the local server', () => {
  const call = async (...args: string[]) =>
    run(process.execPath, [cli, ...args, '--base-url', baseUrl], {
      env: { ...process.env, BOOK_SEARCH_BASE_URL: 'http://127.0.0.1:1' },
    });

  it('prints results as text, with the page and the link', async () => {
    const { stdout } = await call('search', 'noble', 'truths');
    expect(stdout).toContain('1. Book B - PDF page 1');
    expect(stdout).toContain('https://cdn.example/en/Book%20B.pdf#page=1');
  });
  it('marks OCR pages with their confidence', async () => {
    const { stdout } = await call('search', 'သီလ သမာဓိ');
    expect(stdout).toContain('[OCR 0.82]');
  });
  it('prints the API response with --json', async () => {
    const { stdout } = await call(
      'search',
      'noble truths',
      '--json',
      '--limit',
      '1',
    );
    expect(JSON.parse(stdout)).toMatchObject({
      v: 1,
      query: { limit: 1 },
      results: [{ bookId: 'bbbbbbbbbbbb' }],
    });
  });
  it('says so when nothing matches, and shows health', async () => {
    expect((await call('search', 'nonexistentword')).stdout).toContain(
      'No matches.',
    );
    expect((await call('health')).stdout).toContain(
      '2 books, 4 pages, 6 passages',
    );
  });
  it('exits 1 with the service error code', async () => {
    await expect(call('search', 'abc', '--lang', 'fr')).rejects.toMatchObject({
      code: 1,
    });
    const failure = await call('search', 'abc', '--limit', '99').catch(
      (e) => e,
    );
    expect(failure.code).toBe(1);
    expect(failure.stderr).toContain('400 bad_param');
  });
  it('takes the base URL from BOOK_SEARCH_BASE_URL when --base-url is absent', async () => {
    const { stdout } = await run(process.execPath, [cli, 'health'], {
      env: { ...process.env, BOOK_SEARCH_BASE_URL: baseUrl },
    });
    expect(stdout).toContain('2 books');
  });
});
