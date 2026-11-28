import { defineConfig, devices } from '@playwright/test';

// The DOM adapter is tested on a page the spec builds itself (tests/dom.spec.ts): no server needed.
export default defineConfig({
  testDir: './tests',
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
});
