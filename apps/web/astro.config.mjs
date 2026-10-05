import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';
import { validateMessages } from './src/i18n/messages.ts';

// Local overrides live at the repository root; injected CI variables take precedence.
const localEnv = new URL('../../.env.local', import.meta.url);
if (existsSync(localEnv)) loadEnvFile(localEnv);

validateMessages();
export default defineConfig({
  // Set SITE_URL in each deployed environment (see .env.example).
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  vite: {
    plugins: [tailwind()],
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
