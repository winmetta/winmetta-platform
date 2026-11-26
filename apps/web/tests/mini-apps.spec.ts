import { expect, test } from '@playwright/test';

// Mini apps (docs/meditation-bell.md §2). Built always; linked and indexable only with PUBLIC_MINI_APPS.
const enabled = process.env.PUBLIC_MINI_APPS === 'true';
const feedback = process.env.PUBLIC_FEEDBACK === 'true';

test('the listing shows a tile per mini app, linking only the ones that exist', async ({
  page,
}) => {
  await page.goto('/en/mini-apps/');
  await expect(page.locator('h1')).toHaveText('Mini apps');
  const tiles = page.locator('ul.mini-grid > li');
  await expect(tiles).toHaveCount(2);
  const bell = page.locator('a.mini-tile');
  await expect(bell).toHaveCount(1);
  await expect(bell).toHaveAttribute('href', '/en/mini-apps/meditation-bell/');
  await expect(bell).toContainText('Meditation bell');
  await expect(page.locator('.mini-tile--coming')).toContainText(
    'Coming later',
  );
  // Normal site page: it keeps the header and footer.
  await expect(page.locator('.site-header')).toBeVisible();
});

test('the listing is fully translated in Burmese', async ({ page }) => {
  await page.goto('/my/mini-apps/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  await expect(page.locator('h1')).toHaveText('အက်ပ်ငယ်များ');
});

test('the menu links the listing only when mini apps are on', async ({
  page,
}) => {
  await page.goto('/en/about/');
  await expect(page.locator('#site-nav a[href="/en/mini-apps/"]')).toHaveCount(
    enabled ? 1 : 0,
  );
});

test('noindex until mini apps are on', async ({ page }) => {
  for (const path of ['/en/mini-apps/', '/en/mini-apps/meditation-bell/']) {
    await page.goto(path);
    const robots = page.locator('meta[name="robots"]');
    if (enabled && process.env.PUBLIC_ALLOW_INDEXING === 'true')
      await expect(robots).toHaveCount(0);
    else if (!enabled)
      await expect(robots).toHaveAttribute('content', /noindex/);
  }
});

test('the bell page has its own layout, back link, language switch and canonical', async ({
  page,
}) => {
  await page.goto('/en/mini-apps/meditation-bell/');
  await expect(page.locator('.site-header, .site-footer')).toHaveCount(0);
  const back = page.locator('[data-mini-bar] a[href="/en/mini-apps/"]');
  await expect(back).toBeVisible();
  await expect(back).toContainText('Mini apps');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/en\/mini-apps\/meditation-bell\/$/,
  );
  const myanmar = page.locator('[data-mini-bar] a[data-locale="my"]');
  await expect(myanmar).toHaveText('ကခဂ');
  await expect(myanmar).toHaveAttribute('lang', 'my');
  await expect(myanmar).toHaveAccessibleName('Myanmar');
  await myanmar.click();
  await expect(page).toHaveURL(/\/my\/mini-apps\/meditation-bell\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
});

test('the language switch keeps the query and fragment', async ({ page }) => {
  await page.goto('/en/mini-apps/meditation-bell/?x=1#top');
  await page.locator('[data-mini-bar] a[data-locale="my"]').click();
  await expect(page).toHaveURL(/\/my\/mini-apps\/meditation-bell\/\?x=1#top$/);
});

test('leaving asks first while something is running, and not otherwise', async ({
  page,
}) => {
  await page.goto('/en/mini-apps/meditation-bell/');
  const back = page.locator('[data-mini-bar] a[href="/en/mini-apps/"]');
  // Nothing set: no question.
  await back.click();
  await expect(page).toHaveURL(/\/en\/mini-apps\/$/);
  // Something set: declining stays, accepting leaves.
  await page.goto('/en/mini-apps/meditation-bell/');
  await page.evaluate(() => {
    document.body.dataset.miniAppBusy = 'true';
  });
  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await back.click();
  await expect(page).toHaveURL(/\/en\/mini-apps\/meditation-bell\/$/);
  expect(messages).toHaveLength(1);
  await page.evaluate(() => {
    document.body.dataset.miniAppBusy = 'false';
  });
  await back.click();
  await expect(page).toHaveURL(/\/en\/mini-apps\/$/);
});

test('the footer Feedback button opens the dialog with the mini app filled in', async ({
  page,
}) => {
  test.skip(!feedback, 'needs PUBLIC_FEEDBACK');
  await page.goto('/en/mini-apps/meditation-bell/');
  const button = page.locator('.mini-footer a[data-feedback="general"]');
  await expect(button).toHaveAccessibleName('Send feedback');
  await button.click();
  const dialog = page.locator('[data-feedback-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-feedback-about]')).toContainText(
    'Meditation bell',
  );
});

test('the footer has no Feedback button when feedback is off', async ({
  page,
}) => {
  test.skip(feedback, 'feedback is on');
  await page.goto('/en/mini-apps/meditation-bell/');
  await expect(page.locator('.mini-footer a')).toHaveCount(0);
});
