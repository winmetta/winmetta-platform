// Run from infra/pulumi: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Load the function the way CloudFront does: plain source text, no module system.
const source = fs.readFileSync(
  new URL('./viewer-request.js', import.meta.url),
  'utf8',
);
const handler = new Function(`${source}; return handler;`)();

const run = (uri, querystring = {}) =>
  handler({ request: { uri, querystring } });

test('the root maps to index.html', () => {
  assert.equal(run('/').uri, '/index.html');
});

test('a directory URL maps to its index.html', () => {
  assert.equal(run('/en/about/').uri, '/en/about/index.html');
  assert.equal(run('/my/library/').uri, '/my/library/index.html');
});

test('a missing trailing slash redirects with 301 and keeps the query', () => {
  const response = run('/en/about');
  assert.equal(response.statusCode, 301);
  assert.equal(response.headers.location.value, '/en/about/');

  const withQuery = run('/en/library', {
    q: { value: 'dhamma' },
    tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] },
  });
  assert.equal(
    withQuery.headers.location.value,
    '/en/library/?q=dhamma&tag=a&tag=b',
  );
});

test('files with an extension pass through unchanged', () => {
  for (const uri of [
    '/robots.txt',
    '/sitemap-index.xml',
    '/_astro/app.abc123.js',
    '/library-data/a.9f.json',
    '/404.html',
  ]) {
    assert.equal(run(uri).uri, uri);
  }
});
