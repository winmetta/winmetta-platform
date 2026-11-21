import test from 'node:test';
import assert from 'node:assert/strict';
import { devBookIds, ensureBookSearchIndex } from './dev-setup.mjs';

const ids = ['b1', 'b2'];
function setup(overrides = {}) {
  const calls = [];
  const logs = [];
  const state = { index: false, poppler: true, brew: true };
  const deps = {
    ids,
    interactive: true,
    hasIndex: () => state.index,
    hasTool: (name) => (name === 'pdftotext' ? state.poppler : state.brew),
    run: (command, args) => {
      calls.push([command, ...args].join(' '));
      if (command === 'npm' && args[1] === 'book-search:build')
        state.index = true;
      if (command === 'brew') state.poppler = true;
      return 0;
    },
    ask: async () => true,
    log: (line) => logs.push(line),
    ...overrides,
  };
  return { deps, calls, logs, state };
}

test('the dev books are the ones marked dev', () => {
  assert.deepEqual(
    devBookIds({
      books: [{ id: 'a' }, { id: 'b', dev: true }, { id: 'c', dev: true }],
    }),
    ['b', 'c'],
  );
});

test('does nothing when an index already exists', async () => {
  const { deps, calls } = setup();
  deps.hasIndex = () => true;
  assert.equal(await ensureBookSearchIndex(deps), true);
  assert.deepEqual(calls, []);
});

test('fetches, indexes without OCR and builds, in that order, when there is no index', async () => {
  const { deps, calls, logs } = setup();
  assert.equal(await ensureBookSearchIndex(deps), true);
  assert.deepEqual(calls, [
    'npm run book-search:fetch -- b1 b2',
    'npm run book-search:index -- b1 b2 --ocr never',
    'npm run book-search:build -- b1 b2 --allow-incomplete',
  ]);
  assert.ok(logs.some((l) => l.includes('building a small one')));
});

test('offers to install Poppler with Homebrew on a terminal, then builds', async () => {
  const { deps, calls, state } = setup();
  state.poppler = false;
  const asked = [];
  deps.ask = async (question) => {
    asked.push(question);
    return true;
  };
  assert.equal(await ensureBookSearchIndex(deps), true);
  assert.equal(asked.length, 1);
  assert.match(asked[0], /brew install poppler/);
  assert.equal(calls[0], 'brew install poppler');
  assert.equal(calls.length, 4);
});

test('skips book search, saying why, when Poppler is missing and the user declines', async () => {
  const { deps, calls, logs, state } = setup();
  state.poppler = false;
  deps.ask = async () => false;
  assert.equal(await ensureBookSearchIndex(deps), false);
  assert.deepEqual(calls, []);
  assert.ok(logs.join('\n').includes('brew install poppler'));
});

test('never installs anything when not on a terminal or without Homebrew', async () => {
  for (const change of [{ interactive: false }, {}]) {
    const { deps, calls, state } = setup(change);
    state.poppler = false;
    if (!('interactive' in change)) state.brew = false;
    let asked = false;
    deps.ask = async () => {
      asked = true;
      return true;
    };
    assert.equal(await ensureBookSearchIndex(deps), false);
    assert.deepEqual(calls, []);
    assert.equal(asked, false);
  }
});

test('reports a failing step and stops, without throwing', async () => {
  const { deps, calls, logs } = setup();
  deps.run = (command, args) => {
    calls.push([command, ...args].join(' '));
    return args[1] === 'book-search:index' ? 1 : 0;
  };
  assert.equal(await ensureBookSearchIndex(deps), false);
  assert.equal(calls.length, 2);
  assert.ok(
    logs.some((l) => l.includes('book-search:index') && l.includes('failed')),
  );
});

test('says so when no dev books are marked', async () => {
  const { deps, logs } = setup({ ids: [] });
  assert.equal(await ensureBookSearchIndex(deps), false);
  assert.ok(logs[0].includes('No dev books'));
});
