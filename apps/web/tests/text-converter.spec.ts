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
  await expect(
    page.getByRole('textbox', { name: 'Result', exact: true }),
  ).toHaveClass(/font-zawgyi/);
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

test('the input has its own Copy, and Clear looks destructive', async ({
  page,
}) => {
  await open(page);
  const copy = page.getByRole('button', { name: 'Copy what you typed' });
  const clear = page.getByRole('button', { name: 'Clear' });
  await expect(copy).toBeDisabled();
  await expect(clear).toBeDisabled();
  await expect(clear).toHaveClass(/mini-button--danger/);
  await expect(copy).not.toHaveClass(/mini-button--danger/);
  await page.getByLabel('Text to convert').fill('abc');
  await expect(copy).toBeEnabled();
  await expect(clear).toBeEnabled();
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

test('the Converter shows the input in a font the reader picks and the result in the chosen encoding’s font', async ({
  page,
}) => {
  await open(page);
  const input = page.getByLabel('Text to convert');
  const result = page.getByRole('textbox', { name: 'Result', exact: true });
  await input.fill('ျမန္မာစာ ေလ့လာျခင္း');
  // Auto detects Zawgyi, so the input is shown in the Zawgyi font until the reader picks another.
  await expect(input).toHaveClass(/font-zawgyi/);
  await expect(
    page.getByText('Shown in Unicode font: Noto Sans Myanmar'),
  ).toHaveCount(1);
  const font = page.getByRole('group', { name: 'Show the text in the font' });
  await expect(page.getByText('Shown in Zawgyi-One')).toHaveCount(1);
  await expect(font.getByRole('button', { name: 'Zawgyi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await font.getByRole('button', { name: 'Unicode' }).click();
  await expect(input).not.toHaveClass(/font-/);
  await font.getByRole('button', { name: 'Win Innwa' }).click();
  await expect(input).toHaveClass(/font-win-innwa/);
  await expect(page.getByText('Shown in Win Innwa')).toBeVisible();
  // Converting does not change the preview, only the result's font follows To.
  await expect(result).not.toHaveClass(/font-/);
  await page.locator('#converter-to').selectOption('win-innwa');
  await expect(result).toHaveClass(/font-win-innwa/);
  await expect(page.getByText('Shown in Win Innwa')).toHaveCount(2);
  await expect(input).toHaveClass(/font-win-innwa/);
  // Changing From goes back to following the encoding.
  await page.locator('#converter-from').selectOption('zawgyi');
  await expect(input).toHaveClass(/font-zawgyi/);
  // Both bundled fonts really load and are the ones in use.
  const loaded = await page.evaluate(async () => {
    const checks: [string, string][] = [
      ["16px 'Zawgyi-One'", 'ျမန္မာ'],
      ["16px 'Win Innwa'", 'jrefrm'],
    ];
    const results: boolean[] = [];
    for (const [font, sample] of checks) {
      await document.fonts.load(font, sample);
      results.push(document.fonts.check(font, sample));
    }
    return results;
  });
  expect(loaded).toEqual([true, true]);
});

test('the input placeholder is written in the encoding of the shown font', async ({
  page,
}) => {
  await open(page, '/my/mini-apps/burmese-text-converter/');
  const input = page.locator('#converter-input');
  // Unicode: ေ comes after its consonant. Zawgyi: ေ is written before it.
  await expect(input).toHaveAttribute('placeholder', /နေရာ/);
  await page
    .getByRole('group', { name: /ဖောင့်/ })
    .getByRole('button')
    .nth(1)
    .click();
  await expect(input).toHaveAttribute('placeholder', /ေနရာ/);
  await expect(input).toHaveAttribute('placeholder', /\u106B/);
});
