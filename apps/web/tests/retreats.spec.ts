import { expect, test } from '@playwright/test';

test('retreats page says none is scheduled and lists the archive', async ({
  page,
}) => {
  await page.goto('/en/retreats/');
  await expect(page.getByRole('note')).toContainText('No retreat is scheduled');
  await expect(page.locator('main li.card-link')).toHaveCount(15);
});
test('archive search and filters keep their state across a language switch', async ({
  page,
}) => {
  await page.goto('/en/retreats/');
  await page.getByRole('searchbox').fill('kovida');
  await expect(page.locator('main li.card-link')).toHaveCount(1);
  await page.getByLabel('Year').selectOption('2024');
  await expect(page).toHaveURL(/q=kovida&year=2024/);
  await page.getByRole('link', { name: 'မြန်မာ', exact: true }).click();
  await expect(page).toHaveURL(/\/my\/retreats\/\?q=kovida&year=2024/);
  await expect(page.locator('main li.card-link')).toHaveCount(1);
  await page.goto('/en/retreats/?days=3');
  await expect(page.locator('main li.card-link')).toHaveCount(1);
});
test('retreat detail page shows dates, venue and teacher link', async ({
  page,
}) => {
  await page.goto('/en/retreats/kundadhana-2025-04/');
  await expect(page.locator('h1')).toContainText('3-day retreat');
  await expect(page.getByText('Kusalakari Monastery')).toBeVisible();
  await page.locator('dl a[href*="/teachers/"]').click();
  await expect(page).toHaveURL(/\/en\/teachers\/kundadhana\/$/);
  await expect(
    page.getByRole('heading', { name: 'Retreats led' }),
  ).toBeVisible();
});
test('zoom help page has install links in both languages', async ({ page }) => {
  for (const code of ['en', 'my']) {
    await page.goto(`/${code}/zoom-help/`);
    await expect(
      page.locator('a[href="https://zoom.us/download"]'),
    ).toBeVisible();
    await expect(page.locator('main h2')).toHaveCount(6);
  }
});

test('format and length filters narrow the archive and cards show a format icon', async ({
  page,
}) => {
  await page.goto('/en/retreats/');
  const cards = page.locator('main li.card-link');
  await expect(cards).toHaveCount(15);
  await page.getByLabel('Format').selectOption('hybrid');
  await expect(cards).toHaveCount(3); // 12th, 13th and the Kuṇḍadhāna 3-day retreat
  await page.getByLabel('Length').selectOption('3');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Online and in person');
  await expect(cards.first()).not.toContainText('Zoom)');
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(cards).toHaveCount(15);
});
