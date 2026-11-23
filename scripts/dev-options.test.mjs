import test from 'node:test';
import assert from 'node:assert/strict';
import { devEnv, parseDevArgs } from './dev-options.mjs';

const ports = { feedback: 4322, bookSearch: 4323 };

test('both features are on by default and every other argument goes to Astro', () => {
  assert.deepEqual(parseDevArgs([]), {
    feedback: true,
    bookSearch: true,
    rest: [],
  });
  assert.deepEqual(parseDevArgs(['--force', '--port', '4400']), {
    feedback: true,
    bookSearch: true,
    rest: ['--force', '--port', '4400'],
  });
});

test('each switch turns off only its own feature and is not passed on', () => {
  assert.deepEqual(parseDevArgs(['--no-feedback']), {
    feedback: false,
    bookSearch: true,
    rest: [],
  });
  assert.deepEqual(parseDevArgs(['--force', '--no-book-search']), {
    feedback: true,
    bookSearch: false,
    rest: ['--force'],
  });
  assert.deepEqual(parseDevArgs(['--no-feedback', '--no-book-search']), {
    feedback: false,
    bookSearch: false,
    rest: [],
  });
});

test('the default environment turns both features on and points at the stubs', () => {
  assert.deepEqual(
    devEnv({ feedback: true, bookSearch: true, hasIndex: true, ports }),
    {
      PUBLIC_FEEDBACK: 'true',
      PUBLIC_FEEDBACK_POSTS_REVIEWED: 'true',
      FEEDBACK_STUB_URL: 'http://127.0.0.1:4322',
      PUBLIC_BOOK_SEARCH: 'true',
      BOOK_SEARCH_STUB_URL: 'http://127.0.0.1:4323',
      PUBLIC_DONATE: 'true',
    },
  );
});

test('a switched-off feature is explicitly off, with no stub address', () => {
  const env = devEnv({
    feedback: false,
    bookSearch: false,
    hasIndex: true,
    ports,
  });
  assert.equal(env.PUBLIC_FEEDBACK, 'false');
  assert.equal(env.PUBLIC_FEEDBACK_POSTS_REVIEWED, 'false');
  assert.equal(env.FEEDBACK_STUB_URL, '');
  assert.equal(env.PUBLIC_BOOK_SEARCH, 'false');
  assert.equal(env.BOOK_SEARCH_STUB_URL, '');
  // The Dāna page has no stub and no switch: always linked in local dev.
  assert.equal(env.PUBLIC_DONATE, 'true');
});

test('book search stays off when no index is built, whatever was asked', () => {
  const env = devEnv({
    feedback: true,
    bookSearch: true,
    hasIndex: false,
    ports,
  });
  assert.equal(env.PUBLIC_BOOK_SEARCH, 'false');
  assert.equal(env.BOOK_SEARCH_STUB_URL, '');
  assert.equal(env.PUBLIC_FEEDBACK, 'true');
});
