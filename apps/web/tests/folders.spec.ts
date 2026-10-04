import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const folders: { id: string; path: string }[] = JSON.parse(
  readFileSync(new URL('../src/library/folders.json', import.meta.url), 'utf8'),
);
const idOf = (prefix: string): string => {
  const entry = folders.find((f) => f.path.startsWith(prefix));
  if (!entry) throw new Error(`no folder ${prefix}`);
  return entry.id;
};
const bigFolder = idOf('၉။'); // about 395 books: several pages
const nestedFolder = folders.find((f) => f.path.split('/').length === 2)!.id;

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('folders can be browsed and books downloaded', async ({ page }) => {
    await page.goto('/en/dhamma-library/');
    const tree = page.getByRole('heading', { name: 'Browse by folder' });
    await expect(tree).toBeVisible();
    await page.locator('a[href*="/folders/"]').first().click();
    await expect(page).toHaveURL(/\/en\/dhamma-library\/folders\/f\d{3}\/$/);
    await expect(page.locator('h1')).toBeVisible();
    await page.goto(`/en/dhamma-library/folders/${bigFolder}/`);
    await expect(page.locator('h3')).toHaveCount(50);
    const link = page.getByRole('link', { name: /Download PDF/ }).first();
    expect(await link.getAttribute('href')).toMatch(
      /^https:\/\/dhamma-library\.b-cdn\.net\/.+\.pdf$/,
    );
  });
});

test('landing page lists every top-level folder with a book count', async ({
  page,
}) => {
  await page.goto('/en/dhamma-library/');
  const section = page.locator('section[aria-labelledby="folders"]');
  expect(await section.locator('a[href*="/folders/"]').count()).toBeGreaterThan(
    50,
  );
  await expect(section.getByText(/\d+ books/).first()).toBeVisible();
});

test('pagination walks through a large folder', async ({ page }) => {
  await page.goto(`/en/dhamma-library/folders/${bigFolder}/`);
  const pager = page.getByRole('navigation', { name: 'Pages' });
  await expect(pager.getByRole('link', { name: 'Previous page' })).toHaveCount(
    0,
  );
  await pager.getByRole('link', { name: 'Next page' }).click();
  await expect(page).toHaveURL(new RegExp(`/folders/${bigFolder}/2/$`));
  await expect(pager.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`/en/dhamma-library/folders/${bigFolder}/2/$`),
  );
  await pager.getByRole('link', { name: 'Previous page' }).click();
  await expect(page).toHaveURL(new RegExp(`/folders/${bigFolder}/$`));
});

test('breadcrumbs lead back up the tree', async ({ page }) => {
  await page.goto(`/en/dhamma-library/folders/${nestedFolder}/`);
  const crumbs = page.getByRole('navigation', { name: 'You are here' });
  await expect(crumbs.locator('[aria-current="page"]')).toBeVisible();
  await crumbs.getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/\/folders\/f\d{3}\/$/);
  await expect(page.getByRole('heading', { name: 'Subfolders' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'You are here' })
    .getByRole('link')
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/dhamma-library\/$/);
});

test('switching language keeps the folder and page', async ({ page }) => {
  await page.goto(`/en/dhamma-library/folders/${bigFolder}/2/`);
  await page.locator('a[data-locale="my"]').click();
  await expect(page).toHaveURL(
    new RegExp(`/my/dhamma-library/folders/${bigFolder}/2/$`),
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute(
    'href',
    new RegExp(`/en/dhamma-library/folders/${bigFolder}/2/$`),
  );
});

test('a folder page fits a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`/my/dhamma-library/folders/${bigFolder}/`);
  await expect(page.locator('h3').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
