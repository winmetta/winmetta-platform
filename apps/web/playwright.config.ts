import { defineConfig, devices } from '@playwright/test';
// Own port, so the tests never reuse a developer's dev server on 4321 (it serves unbuilt pages).
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4331' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4331 --ignore-lock',
    url: 'http://127.0.0.1:4331',
    reuseExistingServer: !process.env.CI,
  },
});
