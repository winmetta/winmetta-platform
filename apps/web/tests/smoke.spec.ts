import { expect, test } from '@playwright/test';
test('locale routes, layout and local Burmese font', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'မြန်မာ' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  await expect(page.locator('h1')).toContainText('ဓမ္မကို');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('16px "Noto Sans Myanmar"', 'မြန်မာ'),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => entry.name.includes('.woff2')),
    ),
  ).toBe(true);
  await page.locator('a[data-locale="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText(
    'Learn the Dhamma with Win Metta',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://localhost:4321/en/',
  );
  await expect(page.locator('link[hreflang="my"]')).toHaveAttribute(
    'href',
    'http://localhost:4321/my/',
  );
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('switching preserves query/hash when preference storage is blocked', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    }),
  );
  await page.goto('/en/?q=sample&type=book#main');
  await page.getByRole('link', { name: 'မြန်မာ', exact: true }).click();
  await expect(page).toHaveURL(/\/my\/\?q=sample&type=book#main$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
});
test('explicit locale wins over stored preference and narrow screens reflow', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('winmetta.locale', 'my'));
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole('link', { name: 'မြန်မာ', exact: true }).click();
  // Measure the Burmese page, not the page being left.
  await expect(page).toHaveURL(/\/my\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem('winmetta.locale')),
  ).toBe('my');
});
test('language switch uses the URL at activation time, not at page load', async ({
  page,
}) => {
  await page.goto('/en/?q=first');
  await page.evaluate(() => {
    history.replaceState(null, '', '/en/?q=second&type=book');
    location.hash = 'main';
  });
  await page.getByRole('link', { name: 'မြန်မာ', exact: true }).click();
  await expect(page).toHaveURL(/\/my\/\?q=second&type=book#main$/);
  await page.evaluate(() => {
    history.replaceState(null, '', '/my/?q=third#results');
  });
  await page.locator('a[data-locale="en"]').click();
  await expect(page).toHaveURL(/\/en\/\?q=third#results$/);
});
