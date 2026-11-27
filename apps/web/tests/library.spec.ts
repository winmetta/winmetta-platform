import { expect, test, type Page } from '@playwright/test';

const book = 'ဓမ္မပဒ';
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search books and apps' });
const dataRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/library-data/')) urls.push(request.url());
  });
  return urls;
};

test('study apps are reachable from the library in both languages', async ({
  page,
}) => {
  await page.goto('/en/');
  await expect(
    page.locator('main').getByRole('link', { name: 'Dhamma Study Apps' }),
  ).toHaveAttribute('href', '/en/dhamma-library/apps/');
  await expect(
    page.locator('#site-nav').getByRole('link', {
      name: 'Dhamma Apps',
      includeHidden: true,
    }),
  ).toHaveAttribute('href', '/en/dhamma-library/apps/');
  await page.goto('/en/dhamma-library/');
  await page
    .getByRole('link', { name: 'Explore Pāḷi and Dhamma study apps' })
    .click();
  await expect(page).toHaveURL(/\/en\/dhamma-library\/apps\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Dhamma Study Apps',
  );
  await expect(
    page.getByRole('heading', { name: 'Tipitaka Pāḷi Reader' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Digital Pāḷi Dictionary' }),
  ).toBeVisible();
  await expect(page.locator('main li > img')).toHaveCount(5);
  const reader = page.locator('#tipitaka-pali-reader');
  for (const label of [
    'Visit website',
    'Windows',
    'iPhone, iPad and Mac',
    'Android',
    'Linux (Flathub)',
  ]) {
    const link = reader.getByRole('link', {
      name: `${label}: Tipitaka Pāḷi Reader`,
    });
    await expect(link).toBeVisible();
    await expect(link.locator('svg, img')).toHaveCount(1);
  }
  await page.locator('a[data-locale="my"]').click();
  await expect(page).toHaveURL(/\/my\/dhamma-library\/apps\/$/);
  await page.waitForLoadState('load');
  await expect(
    page.locator('#site-nav').getByRole('link', {
      name: 'ဓမ္မ Apps',
      includeHidden: true,
    }),
  ).toHaveAttribute('href', '/my/dhamma-library/apps/');
  await expect(
    page.getByRole('heading', { name: 'ဓမ္မလေ့လာရေး Apps' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '← ဓမ္မစာကြည့်တိုက်သို့ ပြန်သွားရန်' })
    .click();
  await expect(page).toHaveURL(/\/my\/dhamma-library\/$/);
});

test('digital Pāḷi texts are reachable from the library in both languages', async ({
  page,
}) => {
  await page.goto('/en/dhamma-library/');
  await page
    .getByRole('link', { name: 'Find digital Pāḷi texts to reuse' })
    .click();
  await expect(page).toHaveURL(/\/en\/dhamma-library\/digital-texts\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Digital Pāḷi Texts',
  );
  await expect(page.locator('main li.card')).toHaveCount(7);
  await expect(
    page.getByRole('link', {
      name: 'Burmese-script files: VRI Chaṭṭha Saṅgāyana Tipiṭaka XML',
    }),
  ).toHaveAttribute(
    'href',
    'https://github.com/VipassanaTech/tipitaka-xml/tree/main/mymr',
  );
  const sources = page.getByRole('link', { name: /^Source on GitHub: / });
  await expect(sources).toHaveCount(6);
  for (const link of await sources.all())
    await expect(link.locator('img[src*="GitHub"]')).toHaveCount(1);
  await expect(
    page.locator('#site-nav').getByRole('link', {
      name: 'Digital Texts',
      includeHidden: true,
    }),
  ).toHaveAttribute('href', '/en/dhamma-library/digital-texts/');
  await page.locator('a[data-locale="my"]').click();
  await expect(page).toHaveURL(/\/my\/dhamma-library\/digital-texts\/$/);
  await expect(
    page.getByRole('heading', { name: 'Digital စာပေများ' }),
  ).toBeVisible();
});

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

test('library search finds a study app and opens its recommendation', async ({
  page,
}) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill('Sutamaya');
  const result = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Sutamaya', exact: true }),
  });
  await expect(result).toBeVisible();
  await result.getByRole('link', { name: 'View app' }).click();
  await expect(page).toHaveURL(/\/en\/dhamma-library\/apps\/#sutamaya$/);
  await expect(page.locator('#sutamaya')).toBeVisible();
});

test('library search finds an app using a Burmese alias', async ({ page }) => {
  await page.goto('/my/dhamma-library/');
  await page
    .locator('[data-library-search]')
    .getByRole('searchbox')
    .fill('ပါဠိ အဘိဓာန်');
  await expect(
    page.getByRole('heading', { name: 'Digital Pāḷi Dictionary' }),
  ).toBeVisible();
});

test('finds Burmese books and keeps the query in the URL', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill(book);
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
  await expect(
    page.locator('[data-library-search]').getByRole('status'),
  ).toContainText('Results:');
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
    page.getByRole('heading', { name: 'Similar results' }),
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
    .locator('button.text-action[lang="en"]', { hasText: /[A-Za-z]/ })
    .first();
  await expect(english).toBeVisible();
  await search(page).fill(book);
  await expect(
    page.locator('button.text-action[lang="my"]').first(),
  ).toBeVisible();
});

test('empty results explain what to do', async ({ page }) => {
  await page.goto('/en/dhamma-library/');
  await search(page).fill('zzzzqqqq');
  await expect(page.getByText(/No results found/)).toBeVisible();
});

test('language switch keeps the query', async ({ page }) => {
  await page.goto('/my/dhamma-library/?q=' + encodeURIComponent(book));
  await expect(page.locator('h3', { hasText: book }).first()).toBeVisible();
  await page.locator('a[data-locale="en"]').click();
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

test('in-place actions are text actions with an icon, not framed buttons', async ({
  page,
}) => {
  await page.goto('/en/dhamma-library/?q=dhamma&tag=Rare-Buddhist-Books-1');
  const catalog = page.locator('[data-library-search]');
  for (const name of ['Clear search', 'Remove folder filter']) {
    const action = catalog.getByRole('button', { name });
    await expect(action).toBeVisible();
    await expect(action).toHaveClass(/text-action/);
    await expect(action).not.toHaveClass(/btn/);
    await expect(action.locator('svg')).toHaveCount(1);
  }
  // The folder name is information, not a control.
  await expect(
    catalog.locator('.folder-name', { hasText: 'Rare-Buddhist-Books-1' }),
  ).toBeVisible();
  // A folder name in a result card is a text action with a folder symbol, not a chip.
  const folderAction = catalog
    .locator('li.card button.text-action', { hasText: 'Rare-Buddhist-Books-1' })
    .first();
  await expect(folderAction.locator('svg')).toHaveCount(1);
  await expect(folderAction).not.toHaveClass(/chip/);
  // Getting a file stays a framed (outline) button.
  await expect(
    catalog.getByRole('link', { name: /Download PDF/ }).first(),
  ).toHaveClass(/btn-outline/);
  await catalog.getByRole('button', { name: 'Remove folder filter' }).click();
  await expect(page).not.toHaveURL(/tag=/);
});

test('a file size is a badge with a document symbol, right after the Download button', async ({
  page,
}) => {
  await page.goto('/en/dhamma-library/?q=dhamma');
  const card = page
    .locator('[data-library-search] li.card', {
      has: page.locator('[data-file-size]'),
    })
    .first();
  const size = card.locator('[data-file-size]');
  await expect(size).toHaveClass(/badge/);
  await expect(size.locator('svg')).toHaveCount(1);
  await expect(size).toHaveText(/\d/);
  // Plain information, not a pill: no background or rounded frame that would look like a button.
  const look = await size.evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      background: css.backgroundColor,
      radius: css.borderRadius,
      cursor: css.cursor,
    };
  });
  expect(look.background).toBe('rgba(0, 0, 0, 0)');
  expect(look.radius).toBe('0px');
  expect(look.cursor).not.toBe('pointer');
  const download = (await card
    .getByRole('link', { name: /Download PDF/ })
    .boundingBox())!;
  const badge = (await size.boundingBox())!;
  expect(badge.x).toBeGreaterThan(download.x + download.width);
  // The same in a folder page's card.
  await page.goto('/en/dhamma-library/folders/f001/');
  const folderCard = page
    .locator('li.card', { has: page.locator('[data-file-size]') })
    .first();
  await expect(folderCard.locator('[data-file-size] svg')).toHaveCount(1);
  const d2 = (await folderCard
    .getByRole('link', { name: /Download PDF/ })
    .boundingBox())!;
  const b2 = (await folderCard.locator('[data-file-size]').boundingBox())!;
  expect(b2.x).toBeGreaterThan(d2.x + d2.width);
});

test('in Burmese, counts use Burmese digits and the counter အုပ်', async ({
  page,
}) => {
  await page.goto('/my/dhamma-library/');
  const counts = page.locator('#folders').locator('..').locator('.badge');
  const first = (await counts.first().innerText()).trim();
  expect(first).toMatch(/^[၀-၉,]+ အုပ်$/);
  expect(first).not.toContain('စာအုပ်');
  await page.goto('/my/dhamma-library/folders/f005/');
  const header = (
    await page.locator('header .badge').first().innerText()
  ).trim();
  expect(header).toMatch(/^[၀-၉,]+ အုပ်$/);
  const size = (
    await page.locator('[data-file-size]').first().innerText()
  ).trim();
  expect(size).toMatch(/^[၀-၉.,]+ (kB|MB|GB)$/);
  // English keeps Latin digits.
  await page.goto('/en/dhamma-library/folders/f005/');
  expect(
    (await page.locator('header .badge').first().innerText()).trim(),
  ).toMatch(/^[0-9,]+ books?$/);
});
