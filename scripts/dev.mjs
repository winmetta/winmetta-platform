#!/usr/bin/env node
// `npm run dev` (and `just dev`): start the web app's dev server with the local stand-ins for
// the two small services the site talks to, so the whole site works offline:
//   - the feedback endpoint (scripts/feedback-stub.mjs: the real handler, prints each report)
//   - the book-search API (the real handler on your newest built index in
//     .cache/book-search/dist, see docs/book-search.md; a small one is built on the first run)
// and say plainly if a dev server is already running (Astro allows one per project, and its own
// error is buried in Turborepo output).
//   npm run dev                       start with both features on
//   npm run dev -- --no-feedback      no feedback stub, feedback feature off
//   npm run dev -- --no-book-search   no book-search stub, Search inside PDFs off
//   npm run dev -- --force            replace a running dev server
//   npm run dev:stop                  stop the running dev server (the stubs stop with it)
// Anything else after `--` goes to the Astro dev server unchanged.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devBookIds, ensureBookSearchIndex } from './dev-setup.mjs';
import {
  BOOK_SEARCH_PORT,
  FEEDBACK_PORT,
  devEnv,
  parseDevArgs,
} from './dev-options.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const {
  feedback,
  bookSearch,
  rest: args,
} = parseDevArgs(process.argv.slice(2));

function runningServer() {
  const { stdout = '' } = spawnSync('npx', ['astro', 'dev', 'status'], {
    cwd: web,
    encoding: 'utf8',
  });
  for (const line of stdout.split('\n')) {
    try {
      const { message } = JSON.parse(line);
      const found = /running at (\S+) \(pid (\d+)/.exec(message ?? '');
      if (found) return { url: found[1], pid: found[2] };
    } catch {
      /* not a JSON line */
    }
  }
  return null;
}

if (!existsSync(path.join(root, 'node_modules', '.bin', 'turbo'))) {
  console.error(
    '\n✖ Dependencies are not installed. Run `just setup` (or `npm ci`) first.\n',
  );
  process.exit(1);
}

if (!args.includes('--force')) {
  const running = runningServer();
  if (running) {
    console.error(`
✖ The dev server is already running, so nothing was started.

    URL  ${running.url}
    PID  ${running.pid}

  Open that URL, or stop it first:   npm run dev:stop
  To replace it instead:             npm run dev -- --force
`);
    process.exit(1);
  }
}

const ports = {
  feedback: Number(process.env.FEEDBACK_STUB_PORT ?? FEEDBACK_PORT),
  bookSearch: Number(process.env.BOOK_SEARCH_STUB_PORT ?? BOOK_SEARCH_PORT),
};

/** Whether a built book-search index exists (the same folder `book-search:serve` reads). */
function hasBookSearchIndex() {
  const work =
    process.env.BOOK_SEARCH_WORK_DIR ??
    path.join(root, '.cache', 'book-search');
  const dist = path.join(work, 'dist');
  return (
    existsSync(dist) &&
    readdirSync(dist).some((name) => name.endsWith('.sqlite'))
  );
}

const hasTool = (name) =>
  spawnSync(name, [name === 'pdftotext' ? '-v' : '--version'], {
    stdio: 'ignore',
  }).status === 0;
async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();
  rl.close();
  return answer === '' || answer === 'y' || answer === 'yes';
}

// Search inside PDFs needs a built index; create a small one on the first run, or say what is
// needed (scripts/dev-setup.mjs).
let hasIndex = hasBookSearchIndex();
if (bookSearch && !hasIndex)
  hasIndex = await ensureBookSearchIndex({
    ids: devBookIds(
      JSON.parse(
        readFileSync(
          path.join(root, 'apps/book-search/pilot/books.json'),
          'utf8',
        ),
      ),
    ),
    hasIndex: hasBookSearchIndex,
    hasTool,
    run: (command, commandArgs) =>
      spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit' }).status ??
      1,
    ask,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    log: (line) => console.log(line),
  });

const stubs = [];
function startStub(name, command, commandArgs, port) {
  const stub = spawn(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      FEEDBACK_STUB_PORT: String(ports.feedback),
    },
  });
  stub.on('exit', (code, signal) => {
    if (code && !signal)
      console.error(
        `! The ${name} stub stopped (exit ${code}); is port ${port} in use?`,
      );
  });
  stubs.push(stub);
}
const stopStubs = () => {
  for (const stub of stubs) stub.kill('SIGTERM');
};
process.on('exit', stopStubs);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopStubs();
    process.exit(130);
  });

if (feedback)
  startStub(
    'feedback',
    process.execPath,
    ['scripts/feedback-stub.mjs'],
    ports.feedback,
  );
if (bookSearch && hasIndex)
  startStub(
    'book-search',
    process.execPath,
    [
      'apps/book-search/src/search-cli.ts',
      'serve',
      '--port',
      String(ports.bookSearch),
    ],
    ports.bookSearch,
  );

const child = spawn(
  'npx',
  ['turbo', 'run', 'dev', ...(args.length ? ['--', ...args] : [])],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // The Turborepo "update available" box adds noise to every start.
      TURBO_NO_UPDATE_NOTIFIER: '1',
      ...devEnv({ feedback, bookSearch, hasIndex, ports }),
    },
  },
);
child.on('exit', (code) => {
  stopStubs();
  process.exit(code ?? 1);
});
