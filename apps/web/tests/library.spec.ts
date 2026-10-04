import { expect, test, type Page } from '@playwright/test';

const book = 'ဓမ္မပဒ';
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search books' });
const dataRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/library-data/')) urls.push(request.url());
  });
  return urls;
};

test('search data downloads only when search is used', async ({ page }) => {
  const urls = dataRequests(page);
  await page.goto('/en/dhamma-library/');
  await expect(search(page)).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(urls).toEqual([]);
  await search(page).focus();
  await expect.poll(() => urls.length).toBe(2);
  expect(
    urls.some((u) => /\/library-data\/index\.[0-9a-f]+\.json$/.test(u)),
  ).toBe(true);
});

test('finds Burmese books and keeps the query in the URL', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill(book);
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Results:');
  await expect(page).toHaveURL(/\?q=%E1%80%93/);
  const link = page.getByRole('link', { name: /Download PDF/ }).first();
  expect(await link.getAttribute('href')).toMatch(
    /^https:\/\/dhamma-library\.b-cdn\.net\/.+\.pdf$/,
  );
});

test('a misspelled query shows similar books', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill('ဓမ္မပဒါ');
  await expect(
    page.getByRole('heading', { name: 'Similar books' }),
  ).toBeVisible();
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
  await expect(page.getByText('No exact match.')).toBeVisible();
});

test('a shared link restores the search without typing', async ({ page }) => {
  await page.goto('/en/dhamma-library/?q=' + encodeURIComponent(book));
  await expect(search(page)).toHaveValue(book);
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
});

test('folder filter and reset', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill(book);
  const firstTag = page
    .getByRole('list', { name: 'Folder' })
    .first()
    .getByRole('button')
    .first();
  const tag = (await firstTag.textContent()) ?? '';
  await firstTag.click();
  await expect(page).toHaveURL(/tag=/);
  await expect(
    page.getByRole('button', { name: 'Remove folder filter' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page).not.toHaveURL(/q=|tag=/);
  await expect(search(page)).toHaveValue('');
  expect(tag.length).toBeGreaterThan(0);
});

test('folder chips carry the language of their text', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill('Pali Grammar');
  await expect(page.locator('h3').first()).toBeVisible();
  const english = page
    .locator('button[lang="en"]', { hasText: /[A-Za-z]/ })
    .first();
  await expect(english).toBeVisible();
  await search(page).fill(book);
  await expect(page.locator('button[lang="my"]').first()).toBeVisible();
});

test('empty results explain what to do', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill('zzzzqqqq');
  await expect(page.getByText(/No books found/)).toBeVisible();
});

test('language switch keeps the query', async ({ page }) => {
  await page.goto('/my/dhamma-library/?q=' + encodeURIComponent(book));
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dhamma-library\/\?q=%E1%80%93/);
  await expect(search(page)).toHaveValue(book);
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
});

test('a failed download shows an error and can be retried', async ({
  page,
}) => {
  await page.route('**/library-data/**', (route) => route.abort());
  await page.goto('/en/dhamma-library/');
  await search(page).fill(book);
  await expect(page.getByRole('alert')).toContainText(
    'Search could not be loaded',
  );
  await page.unroute('**/library-data/**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
});

test('narrow screens do not scroll sideways with results', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/my/dhamma-library/?q=' + encodeURIComponent('မြန်မာ'));
  await expect(page.locator('h3').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
