import { expect, test } from '@playwright/test';

test('classes page lists live classes with join and watch links', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  await expect(page.locator('h1')).toHaveText('Classes');
  await expect(page.locator('main li.card[id]')).toHaveCount(9);
  await expect(page.locator('a[href*="zoom.us"]').first()).toBeVisible();
  await expect(
    page.locator('a[href*="youtube.com/@WinMetta"]').first(),
  ).toBeVisible();
  await expect(
    page.getByText('Happening now:').or(page.getByText('Next class:')).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('study groups are Zoom only', async ({ page }) => {
  await page.goto('/en/study-groups/');
  await expect(page.locator('main li.card[id]')).toHaveCount(2);
  await expect(page.locator('a[href*="youtube.com/@WinMetta"]')).toHaveCount(0);
});
test('teacher page shows draft note in English and links from a class', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  await page.locator('#garudhamma-llb a[href*="/teachers/"]').click();
  await expect(page).toHaveURL(/\/en\/teachers\/garudhamma\/$/);
  await expect(page.getByRole('note')).toContainText('draft translation');
  await page.goto('/my/teachers/garudhamma/');
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('weekly schedule table lists every active slot in week order', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  const table = page.getByRole('table', { name: 'Weekly class schedule' });
  await expect(table.locator('tbody tr')).toHaveCount(9); // 7 classes, one with three weekly slots
  await expect(table.locator('tbody tr').first().locator('th')).toHaveText(
    'Thursday',
  );
  await expect(
    table.getByRole('link', { name: /Let’s Learn Burmese/ }),
  ).toHaveAttribute('href', '#garudhamma-llb');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('repeated days in the schedule use the ditto mark', async ({ page }) => {
  await page.goto('/en/classes/');
  const rows = page
    .getByRole('table', { name: 'Weekly class schedule' })
    .locator('tbody tr');
  const days = await rows.locator('th').allInnerTexts();
  // Sunday has several slots: only the first shows its name, the rest show ။.
  expect(days.filter((d) => d.trim() === 'Sunday')).toHaveLength(1);
  expect(days.filter((d) => d.includes('။')).length).toBeGreaterThanOrEqual(3);
});

test('every class card says which language it is taught in', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  const cards = page.locator('main li.card[id]');
  await expect(cards.filter({ hasText: 'Taught in: Burmese' })).toHaveCount(7);
  await expect(cards.filter({ hasText: 'Taught in: English' })).toHaveCount(2); // Let’s Learn Burmese and archived Abhidhamma Study
  await expect(
    page.getByRole('columnheader', { name: 'Language' }),
  ).toBeVisible();
});

test('schedule shows one time column and lets the visitor pick a time zone', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  const table = page.getByRole('table', { name: 'Weekly class schedule' });
  await expect(table.getByRole('columnheader')).toHaveCount(5);
  const select = page.getByLabel('Show times in');
  await expect(select).toHaveValue('pacific');
  const pacific = await table
    .locator('tbody tr')
    .first()
    .locator('td')
    .first()
    .innerText();
  await select.selectOption('myanmar');
  await expect(page).toHaveURL(/tz=myanmar/);
  const myanmar = await table
    .locator('tbody tr')
    .first()
    .locator('td')
    .first()
    .innerText();
  expect(myanmar).not.toBe(pacific);
  await page.getByRole('link', { name: 'မြန်မာ', exact: true }).click();
  await expect(page).toHaveURL(/\/my\/classes\/\?tz=myanmar/);
  await expect(page.locator('select')).toHaveValue('myanmar');
});

test('live-streamed classes show an icon with an accessible label', async ({
  page,
}) => {
  await page.goto('/en/classes/');
  const icon = page.locator('#garudhamma-llb .live-icon');
  await expect(icon).toHaveAttribute('aria-label', 'Live-streamed');
  await expect(
    page.locator('#garudhamma-llb').getByText('Live-streamed', { exact: true }),
  ).toHaveCount(0);
});
