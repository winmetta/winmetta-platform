import { defineConfig } from 'vitest/config';

// The Playwright specs in tests/ are run by `npm run test:browser`, not by Vitest.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
