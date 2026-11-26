import { expect, test, type Page } from '@playwright/test';

// The Burmese text converter mini app (docs/myanmar-converter.md §6).
const PATH = '/en/mini-apps/burmese-text-converter/';

// Typing before the page has hydrated and loaded the converters would be lost, so wait for it.
async function open(page: Page, path = PATH) {
  await page.goto(path);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
}

test('Auto finds Zawgyi and shows Unicode', async ({ page }) => {
  await open(page);
  await page.getByLabel('Text to convert').fill('ျမန္မာစာ ေလ့လာျခင္း');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('မြန်မာစာ လေ့လာခြင်း');
  await expect(page.getByText('Looks like Zawgyi.')).toBeVisible();
});

test('Auto does not convert Pāḷi, and asks the reader to choose', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Text to convert').fill('ဓမ္မစက္ကပ္ပဝတ္တနသုတ္တ');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('');
  await expect(page.getByText(/Cannot tell whether/)).toBeVisible();
  await page.locator('#converter-from').selectOption('unicode');
  await page.locator('#converter-to').selectOption('zawgyi');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).not.toHaveValue('');
  await expect(page.getByText(/Zawgyi text looks wrong/)).toBeVisible();
});

test('converts Win Innwa, swaps and clears', async ({ page }) => {
  await open(page);
  await page.locator('#converter-from').selectOption('win-innwa');
  await page.getByLabel('Text to convert').fill('jrefrm');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('မြန်မာ');
  await page.getByRole('button', { name: /Swap/ }).click();
  await expect(page.locator('#converter-from')).toHaveValue('unicode');
  await expect(page.locator('#converter-to')).toHaveValue('win-innwa');
  await expect(page.getByLabel('Text to convert')).toHaveValue('မြန်မာ');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('jrefrm');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByLabel('Text to convert')).toHaveValue('');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('');
});

test('refuses text over the size limit', async ({ page }) => {
  await open(page);
  // Setting the value directly: typing 200,001 characters one by one would take minutes.
  await page.locator('#converter-input').evaluate((element) => {
    const area = element as HTMLTextAreaElement;
    const set = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    set?.call(area, 'မြန်မာစာ '.repeat(22_223));
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByText(/too long/)).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('');
});

test('sends no request carrying the text', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (request) => {
    const body = request.postData() ?? '';
    if (decodeURIComponent(request.url() + body).includes('ျမန္မာ'))
      sent.push(request.url());
  });
  await open(page);
  await page.getByLabel('Text to convert').fill('ျမန္မာစာ ေလ့လာျခင္း');
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveValue('မြန်မာစာ လေ့လာခြင်း');
  expect(sent).toEqual([]);
});

test('is translated in Burmese', async ({ page }) => {
  await open(page, '/my/mini-apps/burmese-text-converter/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  await expect(page.locator('h1')).toHaveText('မြန်မာစာ ပြောင်းလဲကိရိယာ');
  await expect(page.getByLabel('ပြောင်းလဲမည့် စာသား')).toBeVisible();
});
