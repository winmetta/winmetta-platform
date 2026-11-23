import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@tailwindcss/vite';
import { validateMessages } from './src/i18n/messages.ts';

// Local overrides live at the repository root; injected CI variables take precedence.
const localEnv = new URL('../../.env.local', import.meta.url);
if (existsSync(localEnv)) loadEnvFile(localEnv);

// `npm run dev` / `just dev` start local stand-ins for the site's two small services and set
// FEEDBACK_STUB_URL and BOOK_SEARCH_STUB_URL (scripts/dev.mjs). The dev server forwards
// POST /api/feedback (scripts/feedback-stub.mjs) and GET /api/search (the book-search API on
// the newest local index) there, so the dialog and Search inside PDFs have an endpoint.
// With trailingSlash "always", Astro's dev server answers a path without a slash (these ones)
// with a 404 from a middleware it puts at the front of the stack, so each plugin runs last and
// puts its own handler ahead of that.
function stubProxy(name, target, handles, send) {
  if (!target) return [];
  const forward = async (req, res, next) => {
    if (!handles(req)) return next();
    try {
      await send(req, res, target);
    } catch {
      res.writeHead(502).end();
    }
  };
  return [
    {
      name,
      configureServer: {
        order: 'post',
        handler(server) {
          // Astro finishes installing its middleware asynchronously; the server is listening after.
          server.httpServer?.once('listening', () => {
            server.middlewares.stack.unshift({ route: '', handle: forward });
          });
        },
      },
    },
  ];
}

const pathOf = (req) => req.url?.split('?')[0] ?? '';

async function forwardFeedback(req, res, target) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const reply = await fetch(target, {
    method: req.method,
    headers: { 'content-type': 'application/json' },
    body: ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : Buffer.concat(chunks),
  });
  res.writeHead(reply.status).end();
}

async function forwardBookSearch(req, res, target) {
  const reply = await fetch(`${target}${req.url}`, {
    method: req.method,
    headers: { accept: 'application/json' },
  });
  res
    .writeHead(reply.status, {
      'content-type': reply.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    })
    .end(Buffer.from(await reply.arrayBuffer()));
}

const devStubs = () => [
  ...stubProxy(
    'feedback-stub',
    process.env.FEEDBACK_STUB_URL,
    (req) => pathOf(req) === '/api/feedback',
    forwardFeedback,
  ),
  ...stubProxy(
    'book-search-stub',
    process.env.BOOK_SEARCH_STUB_URL,
    (req) =>
      ['GET', 'HEAD'].includes(req.method) &&
      (pathOf(req) === '/api/search' || pathOf(req).startsWith('/api/search/')),
    forwardBookSearch,
  ),
];

validateMessages();
export default defineConfig({
  // Set SITE_URL in each deployed environment (see .env.example).
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    react(),
    // Lists every built page with its other-language alternate; robots.txt links to it only when indexing is on.
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', my: 'my' } },
      // The root language chooser and the 404 page are not content pages. "Oldest first" post
      // listings repeat the newest-first pages in reverse (they are also noindex).
      filter: (page) =>
        !page.endsWith('/404/') &&
        new URL(page).pathname !== '/' &&
        !/\/dhamma-posts\/(?:tags\/[^/]+\/)?oldest\//.test(page) &&
        // The Dāna page is noindex until its wording is approved (PUBLIC_DONATE, docs/donations.md).
        (process.env.PUBLIC_DONATE === 'true' || !/\/donate\/$/.test(page)),
    }),
  ],
  vite: {
    plugins: [tailwind(), ...devStubs()],
    // Pre-bundle everything the islands import, so a long-running dev server never reloads its
    // dependencies mid-session ("Outdated Optimize Dep" 504s leave islands unhydrated).
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'luxon',
        'minisearch',
        'zod',
        '@radix-ui/react-slot',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
    },
  },
});
