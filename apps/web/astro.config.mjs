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

// `just feedback-dev` sets FEEDBACK_STUB_URL: forward POST /api/feedback to the local stub
// (scripts/feedback-stub.mjs) so the dialog has an endpoint. With trailingSlash "always", Astro's
// dev server answers a path without a slash (this one) with a 404 from a middleware it puts at the
// front of the stack, so the plugin runs last and puts its own handler ahead of that.
function feedbackStub() {
  const target = process.env.FEEDBACK_STUB_URL;
  if (!target) return [];
  const forward = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/feedback') return next();
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const reply = await fetch(target, {
        method: req.method,
        headers: { 'content-type': 'application/json' },
        body: ['GET', 'HEAD'].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      res.writeHead(reply.status).end();
    } catch {
      res.writeHead(502).end();
    }
  };
  return [
    {
      name: 'feedback-stub',
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
        !/\/dhamma-posts\/(?:tags\/[^/]+\/)?oldest\//.test(page),
    }),
  ],
  vite: {
    plugins: [tailwind(), ...feedbackStub()],
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
