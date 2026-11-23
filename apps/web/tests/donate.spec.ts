import { expect, test } from '@playwright/test';

// The Dāna page (docs/donations.md). Built always; linked and indexable only with PUBLIC_DONATE.
const donate = process.env.PUBLIC_DONATE === 'true';
const locales = [
  { code: 'en', title: 'Dāna: support Win Metta' },
  { code: 'my', title: 'ဒါန - Win Metta ကို ထောက်ပံ့ပါ' },
] as const;

for (const l of locales) {
  test(`${l.code} Dāna page shows why and how to give`, async ({ page }) => {
    await page.goto(`/${l.code}/donate/`);
    await expect(page.locator('h1')).toHaveText(l.title);
    await expect(page.locator('html')).toHaveAttribute('lang', l.code);
    const main = page.locator('main');
    await expect(main).toContainText('winmetta.org@gmail.com');
    await expect(main).toContainText('42-2837605');
    await expect(main).toContainText('256 Campana Ave');
    // Five "why give" cards, then the other organizations, each linking its teachers.
    await expect(
      page.locator('section[aria-labelledby="supports"] li.card'),
    ).toHaveCount(5);
    const other = page.locator('section[aria-labelledby="other"]');
    await expect(other.locator('li.card')).toHaveCount(3);
    await expect(
      other.locator(`a[href="/${l.code}/classes/sayadaws/garudhamma/"]`),
    ).toBeVisible();
    // No phone numbers are published (AGENTS.md §2).
    expect(await main.innerText()).not.toMatch(
      /\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/,
    );
  });
}

test('the footer and About link the Dāna page only when it is on', async ({
  page,
}) => {
  await page.goto('/en/about/');
  await expect(page.locator('footer a[href="/en/donate/"]')).toHaveCount(
    donate ? 1 : 0,
  );
  await expect(page.locator('main a[href="/en/donate/"]')).toHaveCount(
    donate ? 1 : 0,
  );
  await page.goto('/en/donate/');
  if (!donate) {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
  } else {
    await expect(page.locator('footer a[aria-current="page"]')).toHaveText(
      'Donate',
    );
  }
});

test('Copy puts the Zelle address on the clipboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/donate/');
  const copy = page
    .locator('section[aria-labelledby="zelle"]')
    .getByRole('button', { name: 'Copy winmetta.org@gmail.com' });
  await copy.click();
  await expect(
    page.locator('section[aria-labelledby="zelle"] .text-action'),
  ).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'winmetta.org@gmail.com',
  );
});

test('language switch keeps the Dāna page', async ({ page }) => {
  await page.goto('/en/donate/');
  await page.locator('a[data-locale="my"]').click();
  await expect(page).toHaveURL(/\/my\/donate\/$/);
});

test('the Dāna page fits a 320px screen in Burmese', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/my/donate/');
  await expect(page.locator('h1')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
