import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHandler } from '../src/handler.ts';

// The fixture index is built by the book-search tests' helper into a temp folder.
import { buildFixtureIndex } from '../../../apps/book-search/test/fixtureIndex.ts';

const event = (url, extra = {}) => {
  const [rawPath, rawQueryString = ''] = url.split('?');
  return {
    rawPath,
    rawQueryString,
    headers: {},
    requestContext: { http: { method: 'GET' } },
    ...extra,
  };
};

async function setup(overrides = {}) {
  const { file } = await buildFixtureIndex();
  const objects = new Map([
    ['releases/library-search-2026-11-20-r1.sqlite', await readFile(file)],
    [
      'releases/library-search-2026-11-20-r1.sqlite.sha256',
      await readFile(`${file}.sha256`),
    ],
  ]);
  const calls = [];
  const logs = [];
  const handler = createHandler({
    getObject: async (key) => {
      calls.push(key);
      const data = objects.get(key);
      if (!data) throw new Error('NoSuchKey');
      return data;
    },
    tmpDir: await mkdtemp(path.join(tmpdir(), 'book-search-lambda-')),
    version: '2026-11-20-r1',
    cdnBase: 'https://cdn.example',
    log: (line) => logs.push(line),
    ...overrides,
  });
  return { handler, objects, calls, logs };
}

test('loads the index once per container and answers searches in the Function URL format', async () => {
  const { handler, calls, logs } = await setup();
  const first = await handler(event('/api/search?q=%22noble%20truths%22'));
  assert.equal(first.statusCode, 200);
  assert.match(first.headers['content-type'], /application\/json/);
  const body = JSON.parse(first.body);
  assert.equal(body.v, 1);
  assert.deepEqual(
    body.results.map((r) => [r.bookId, r.page]),
    [['bbbbbbbbbbbb', 1]],
  );
  await handler(event('/api/search?q=truths'));
  assert.equal(calls.length, 2, 'index and checksum downloaded once');
  assert.equal(logs.filter((l) => l.startsWith('loaded index')).length, 1);
});

test('answers health and contract errors', async () => {
  const { handler } = await setup();
  const health = await handler(event('/api/search/health'));
  assert.equal(JSON.parse(health.body).books, 2);
  const bad = await handler(event('/api/search?q=abc&limit=99'));
  assert.equal(bad.statusCode, 400);
  assert.equal(JSON.parse(bad.body).error.code, 'bad_param');
  const post = await handler(
    event('/api/search?q=abc', {
      requestContext: { http: { method: 'POST' } },
    }),
  );
  assert.equal(post.statusCode, 405);
});

test('answers 503 and retries the load when the index cannot be loaded', async () => {
  const { handler, objects, logs } = await setup();
  const saved = objects.get('releases/library-search-2026-11-20-r1.sqlite');
  objects.delete('releases/library-search-2026-11-20-r1.sqlite');
  const down = await handler(event('/api/search?q=truths'));
  assert.equal(down.statusCode, 503);
  assert.equal(JSON.parse(down.body).error.code, 'index_unavailable');
  assert.ok(logs.some((l) => l.startsWith('index load failed')));
  objects.set('releases/library-search-2026-11-20-r1.sqlite', saved);
  assert.equal((await handler(event('/api/search?q=truths'))).statusCode, 200);
});

test('refuses an index that does not match its checksum', async () => {
  const { handler, objects } = await setup();
  objects.set(
    'releases/library-search-2026-11-20-r1.sqlite.sha256',
    Buffer.from(`${'0'.repeat(64)}  x\n`),
  );
  assert.equal((await handler(event('/api/search?q=truths'))).statusCode, 503);
});

test('never logs a query or a path', async () => {
  const { handler, logs } = await setup();
  await handler(event('/api/search?q=secretwords'));
  await handler(event('/api/search?q=%22%22%22'));
  assert.ok(!logs.join('\n').includes('secretwords'));
  assert.ok(!logs.join('\n').includes('/api/search'));
});

test('hash helper matches what the build wrote', async () => {
  const { file } = await buildFixtureIndex();
  const sha = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  assert.equal((await readFile(`${file}.sha256`, 'utf8')).split(/\s+/)[0], sha);
});
