import { expect, test } from '@playwright/test';
import { siteOrigin, chooseLanguage } from './site';
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
  await chooseLanguage(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText(
    'Learn the Dhamma with Win Metta',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${siteOrigin}/en/`,
  );
  await expect(page.locator('link[hreflang="my"]')).toHaveAttribute(
    'href',
    `${siteOrigin}/my/`,
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
  await chooseLanguage(page, 'my');
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
  await chooseLanguage(page, 'my');
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
  await chooseLanguage(page, 'my');
  await expect(page).toHaveURL(/\/my\/\?q=second&type=book#main$/);
  await page.evaluate(() => {
    history.replaceState(null, '', '/my/?q=third#results');
  });
  await chooseLanguage(page, 'en');
  await expect(page).toHaveURL(/\/en\/\?q=third#results$/);
});

test('on a phone the Menu control is an icon with the word, not a framed button, and its symbol changes when open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  const menu = page.locator('[data-menu]');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Menu');
  const look = await menu.evaluate((el) => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, radius: css.borderRadius };
  });
  expect(look.background).toBe('rgba(0, 0, 0, 0)');
  expect(look.radius).toBe('0px');
  const visibleSymbols = () =>
    menu
      .locator('svg')
      .evaluateAll((all) =>
        all
          .filter((svg) => getComputedStyle(svg).display !== 'none')
          .map((svg) => svg.getAttribute('class')),
      );
  expect(await visibleSymbols()).toEqual(['menu-open']);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  expect(await visibleSymbols()).toEqual(['menu-close']);
});

test('root opens the saved language and Settings resets it', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/en/');
  await chooseLanguage(page, 'my');
  await chooseLanguage(page, 'en');
  await expect(page).toHaveURL(/\/en\/$/);
  await page.goto('/?utm=x');
  await expect(page).toHaveURL(/\/en\/\?utm=x$/);
  // A direct link to another page is never redirected.
  await page.goto('/my/about/');
  await expect(page).toHaveURL(/\/my\/about\/$/);
  await page.getByRole('link', { name: 'ဆက်တင်များ' }).first().click();
  await expect(page.getByRole('button', { name: /English/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('button', { name: 'ဆက်တင်များကို မူလအတိုင်း ပြန်ထားမည်' })
    .click();
  await expect(page.getByText('✓')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ဆက်တင်များကို မူလအတိုင်း ပြန်ထားမည်' }),
  ).toBeDisabled();
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  expect(
    await page.evaluate(() => localStorage.getItem('winmetta.locale')),
  ).toBeNull();
});

test('Settings Reset is disabled until something is saved', async ({
  page,
}) => {
  await page.goto('/en/settings/');
  const reset = page.getByRole('button', { name: 'Reset my settings' });
  await expect(reset).toBeDisabled();
  await page.getByRole('button', { name: /English/ }).click();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(page.getByText('✓ Preferences reset to default.')).toBeVisible();
  await expect(reset).toBeDisabled();
});
