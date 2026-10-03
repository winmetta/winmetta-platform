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
  vite: { plugins: [tailwind()] },
});
