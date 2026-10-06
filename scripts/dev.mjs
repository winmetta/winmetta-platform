#!/usr/bin/env node
// `npm run dev`: start the web app's dev server, but first say plainly if one is already running.
// Astro allows one dev server per project, and its own error is buried in Turborepo output.
//   npm run dev                  start (fails early with a clear message if already running)
//   npm run dev -- --force       replace a running dev server
//   npm run dev:stop             stop the running dev server
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const args = process.argv.slice(2);

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

const child = spawn(
  'npx',
  ['turbo', 'run', 'dev', ...(args.length ? ['--', ...args] : [])],
  {
    stdio: 'inherit',
    // The Turborepo "update available" box adds noise to every start.
    env: { ...process.env, TURBO_NO_UPDATE_NOTIFIER: '1' },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
