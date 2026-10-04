import { expect, test } from '@playwright/test';

const locales = [
  {
    code: 'en',
    home: 'Learn the Dhamma with Win Metta',
    about: 'About Win Metta',
    privacy: 'Privacy',
  },
  {
    code: 'my',
    home: 'Win Metta နှင့်အတူ ဓမ္မကို လေ့လာပါ',
    about: 'Win Metta အကြောင်း',
    privacy: 'ကိုယ်ရေးအချက်အလက်လုံခြုံမှု',
  },
] as const;

for (const l of locales) {
  test.describe(`${l.code} pages`, () => {
    test('Home links to the library, About and Privacy', async ({ page }) => {
      await page.goto(`/${l.code}/`);
      await expect(page.locator('h1')).toHaveText(l.home);
      const start = page.locator('section[aria-labelledby="start"]');
      await expect(start.getByRole('link')).toHaveCount(5);
      await start.locator(`a[href="/${l.code}/dhamma-library/"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${l.code}/dhamma-library/$`));
    });

    test('footer links open About and Privacy', async ({ page }) => {
      await page.goto(`/${l.code}/`);
      const footer = page.locator('footer');
      await footer.locator(`a[href="/${l.code}/about/"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${l.code}/about/$`));
      await expect(page.locator('h1')).toHaveText(l.about);
      await expect(page.locator('html')).toHaveAttribute('lang', l.code);
      await expect(page.locator('footer a[aria-current="page"]')).toHaveCount(
        1,
      );
      await page
        .locator('footer')
        .locator(`a[href="/${l.code}/privacy/"]`)
        .click();
      await expect(page.locator('h1')).toHaveText(l.privacy);
      await expect(
        page.locator('main a[href^="mailto:contact@winmetta.org"]'),
      ).toBeVisible();
    });

    test('the footer is on the library pages too', async ({ page }) => {
      await page.goto(`/${l.code}/dhamma-library/`);
      await expect(
        page.locator(`footer a[href="/${l.code}/about/"]`),
      ).toBeVisible();
      await expect(
        page.locator(`footer a[href="/${l.code}/privacy/"]`),
      ).toBeVisible();
    });
  });
}

test('About links to winmetta.org for more', async ({ page }) => {
  await page.goto('/en/about/');
  await expect(
    page.locator('main a[href="https://winmetta.org/about/"]'),
  ).toBeVisible();
});

test('Privacy states what the site does and shows a Latin-digit date', async ({
  page,
}) => {
  await page.goto('/my/privacy/');
  await expect(page.locator('main')).toContainText('bunny.net');
  await expect(page.locator('main')).toContainText('2026');
  await page.goto('/en/privacy/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  await expect(page.locator('main')).toContainText('October 4, 2026');
});

test('language switch keeps the page and canonical URLs are per page', async ({
  page,
}) => {
  await page.goto('/en/privacy/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://localhost:4321/en/privacy/',
  );
  await expect(page.locator('link[hreflang="my"]')).toHaveAttribute(
    'href',
    'http://localhost:4321/my/privacy/',
  );
  await page.locator('a[data-locale="my"]').click();
  await expect(page).toHaveURL(/\/my\/privacy\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
});

test('new pages fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/my/', '/my/about/', '/my/privacy/']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
