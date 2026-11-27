import type { Page } from '@playwright/test';
// The origin the built pages put in canonical and hreflang links. A deployed site is
// built with SITE_URL set to its own address, so with BASE_URL (the post-deploy check)
// the expected origin is that address; otherwise it is the build's SITE_URL or the
// astro.config.mjs default.
export const siteOrigin = (
  process.env.BASE_URL
    ? new URL(process.env.BASE_URL).origin
    : (process.env.SITE_URL ?? 'http://localhost:4321')
).replace(/\/$/, '');

// Switches the interface language from the site header. Below 48 rem the language links sit in
// a dropdown behind the globe button, so open it first when the button is showing.
export async function chooseLanguage(page: Page, code: 'en' | 'my') {
  const globe = page.locator('[data-lang-button]');
  if (await globe.isVisible()) await globe.click();
  await page.locator(`a[data-locale="${code}"]`).click();
}
