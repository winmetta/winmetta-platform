import { test, expect, type Page, type Route } from '@playwright/test';

const enabled = process.env.PUBLIC_BOOK_SEARCH === 'true';
const section = (page: Page) => page.locator('[data-book-search]');

const hit = (n: number, extra: Record<string, unknown> = {}) => ({
  bookId: `book${n}`,
  title: n === 1 ? 'Power of Mindfulness' : 'ဓမ္မ စာအုပ်',
  language: n === 1 ? 'en' : 'my',
  page: 10 + n,
  snippet: n === 1 ? '… the noble truths …' : '… ဓမ္မ ဒေသနာ …',
  ocr: n === 2,
  confidence: n === 2 ? 0.82 : null,
  pdfUrl: `https://cdn.example/book${n}.pdf#page=${10 + n}`,
  ...extra,
});
const ok = (route: Route, results: unknown[], hasMore = false) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      v: 1,
      indexVersion: 'test',
      query: { q: 'x', lang: 'any', limit: 10, page: 1 },
      hasMore,
      results,
    }),
  });
const failure = (route: Route, status: number, code: string) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ v: 1, error: { code } }),
  });

test('search inside PDFs is absent when its build flag is off', async ({
  page,
}) => {
  test.skip(enabled);
  await page.goto('/en/dhamma-library/');
  await expect(section(page)).toHaveCount(0);
  await page.goto('/en/privacy/');
  await expect(
    page.getByRole('heading', { name: 'Search inside PDFs' }),
  ).toHaveCount(0);
});

test.describe('search inside PDFs enabled', () => {
  test.skip(!enabled);

  for (const [locale, button, openText, copyText, copiedText] of [
    ['en', 'Search', 'Open PDF at this page', 'Copy citation', 'Copied'],
    [
      'my',
      'ရှာမည်',
      'ဤစာမျက်နှာတွင် PDF ဖွင့်ရန်',
      'ကိုးကားချက် ကူးယူရန်',
      'ကူးယူပြီး',
    ],
  ] as const) {
    test(`${locale}: shows pages with the PDF page, OCR mark and links, and copies a citation`, async ({
      page,
      context,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const requests: string[] = [];
      await page.route('**/api/search?*', (route) => {
        requests.push(route.request().url());
        return ok(route, [hit(1), hit(2)]);
      });
      await page.goto(`/${locale}/dhamma-library/`);
      await expect(section(page)).toBeVisible();
      await section(page).getByRole('searchbox').fill('noble truths');
      await section(page).getByRole('button', { name: button }).click();
      const hits = page.locator('[data-book-hit]');
      await expect(hits).toHaveCount(2);
      expect(requests).toHaveLength(1);
      const url = new URL(requests[0]!);
      expect(url.pathname).toBe('/api/search');
      expect(url.searchParams.get('q')).toBe('noble truths');
      expect(url.searchParams.get('limit')).toBe('10');
      // The address now carries the search, so it can be shared.
      expect(new URL(page.url()).searchParams.get('pdf')).toBe('noble truths');
      await expect(hits.nth(0)).toContainText('Power of Mindfulness');
      await expect(hits.nth(0)).toContainText('… the noble truths …');
      await expect(hits.nth(0).locator('a')).toHaveAttribute(
        'href',
        'https://cdn.example/book1.pdf#page=11',
      );
      await expect(hits.nth(0).locator('a')).toHaveText(openText);
      await expect(hits.nth(0).locator('a')).toHaveAttribute('rel', /noopener/);
      // OCR is marked only where the text came from OCR.
      await expect(hits.nth(0).locator('.badge')).toHaveCount(1);
      await expect(hits.nth(1).locator('.badge')).toHaveCount(2);
      // Information is not styled as something to click: no chip, button look or pointer cursor.
      await expect(hits.nth(1).locator('.chip')).toHaveCount(0);
      for (const badge of await hits.nth(1).locator('.badge').all())
        expect(
          await badge.evaluate((el) => getComputedStyle(el).cursor),
        ).not.toBe('pointer');
      // Copy is an icon and words, not a framed button.
      const copy = hits.nth(1).locator('button.text-action');
      await expect(copy.locator('svg')).toHaveCount(1);
      await expect(copy).toContainText(copyText);
      await expect(copy).not.toHaveClass(/btn/);
      await copy.click();
      await expect(copy).toContainText(copiedText);
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain('ဓမ္မ စာအုပ်');
      expect(copied).toContain('https://cdn.example/book2.pdf#page=12');
      expect(copied).toMatch(/PDF/);
    });
  }

  test('a link with ?pdf= searches on load and keeps the other parameters', async ({
    page,
  }) => {
    const queries: string[] = [];
    await page.route('**/api/search?*', (route) => {
      queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
      return ok(route, [hit(1)]);
    });
    await page.goto('/en/dhamma-library/?pdf=noble%20truths&tag=x#top');
    await expect(page.locator('[data-book-hit]')).toHaveCount(1);
    expect(queries).toEqual(['noble truths']);
    await expect(section(page).getByRole('searchbox')).toHaveValue(
      'noble truths',
    );
    expect(new URL(page.url()).searchParams.get('tag')).toBe('x');
  });

  test('the section is spaced from the catalog search above it and the folders below it', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-library/');
    const box = async (selector: string) => {
      const found = await page.locator(selector).first().boundingBox();
      expect(found, selector).not.toBeNull();
      return found!;
    };
    const catalog = await box('[data-library-search]');
    const book = await box('[data-book-search]');
    const folders = await box('section[aria-labelledby="folders"]');
    // The page's section spacing (space-y-10 = 40px) must reach every block: at least 24px.
    expect(book.y - (catalog.y + catalog.height)).toBeGreaterThanOrEqual(24);
    expect(folders.y - (book.y + book.height)).toBeGreaterThanOrEqual(24);
  });

  test('does not search while typing, and an empty query searches nothing', async ({
    page,
  }) => {
    let calls = 0;
    await page.route('**/api/search?*', (route) => {
      calls += 1;
      return ok(route, []);
    });
    await page.goto('/en/dhamma-library/');
    const box = section(page).getByRole('searchbox');
    await box.pressSequentially('noble', { delay: 30 });
    await page.waitForTimeout(400);
    expect(calls).toBe(0);
    await box.fill('   ');
    await box.press('Enter');
    await page.waitForTimeout(200);
    expect(calls).toBe(0);
  });

  test('shows more pages one request at a time', async ({ page }) => {
    const pages: string[] = [];
    await page.route('**/api/search?*', (route) => {
      const n = new URL(route.request().url()).searchParams.get('page') ?? '1';
      pages.push(n);
      return n === '1' ? ok(route, [hit(1)], true) : ok(route, [hit(2)], false);
    });
    await page.goto('/en/dhamma-library/?pdf=truths');
    await expect(page.locator('[data-book-hit]')).toHaveCount(1);
    await section(page)
      .getByRole('button', { name: 'Show more pages' })
      .click();
    await expect(page.locator('[data-book-hit]')).toHaveCount(2);
    expect(pages).toEqual(['1', '2']);
    await expect(
      section(page).getByRole('button', { name: 'Show more pages' }),
    ).toHaveCount(0);
  });

  test('a failed Show more keeps the pages already shown and retries that page', async ({
    page,
  }) => {
    let secondPageFails = true;
    const pages: string[] = [];
    await page.route('**/api/search?*', (route) => {
      const n = new URL(route.request().url()).searchParams.get('page') ?? '1';
      pages.push(n);
      if (n === '1') return ok(route, [hit(1)], true);
      if (secondPageFails) return failure(route, 503, 'index_unavailable');
      return ok(route, [hit(2)], false);
    });
    await page.goto('/en/dhamma-library/?pdf=truths');
    await expect(page.locator('[data-book-hit]')).toHaveCount(1);
    await section(page)
      .getByRole('button', { name: 'Show more pages' })
      .click();
    await expect(section(page).getByRole('alert')).toContainText(
      'not available right now',
    );
    await expect(page.locator('[data-book-hit]')).toHaveCount(1);
    secondPageFails = false;
    await section(page).getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('[data-book-hit]')).toHaveCount(2);
    expect(pages).toEqual(['1', '2', '2']);
  });

  test('says so when nothing matches, when the query is too short and when the service is down', async ({
    page,
  }) => {
    let mode: 'none' | 'short' | 'down' = 'none';
    await page.route('**/api/search?*', (route) =>
      mode === 'none'
        ? ok(route, [])
        : mode === 'short'
          ? failure(route, 400, 'query_too_short')
          : failure(route, 503, 'index_unavailable'),
    );
    await page.goto('/en/dhamma-library/');
    const box = section(page).getByRole('searchbox');
    await box.fill('nothing');
    await box.press('Enter');
    await expect(section(page).getByText(/No page found/)).toBeVisible();
    mode = 'short';
    await box.fill('က');
    await box.press('Enter');
    await expect(
      section(page).getByText('Type a longer word or phrase.'),
    ).toBeVisible();
    mode = 'down';
    await box.fill('truths');
    await box.press('Enter');
    await expect(section(page).getByRole('alert')).toContainText(
      'not available right now',
    );
    // The catalog search still works.
    await expect(page.getByLabel('Search books and apps')).toBeVisible();
    mode = 'none';
    await section(page).getByRole('button', { name: 'Try again' }).click();
    await expect(section(page).getByText(/No page found/)).toBeVisible();
  });

  test('a network failure shows the unavailable message', async ({ page }) => {
    await page.route('**/api/search?*', (route) => route.abort());
    await page.goto('/en/dhamma-library/?pdf=truths');
    await expect(section(page).getByRole('alert')).toContainText(
      'not available right now',
    );
  });

  test('the Privacy page describes the search in both languages', async ({
    page,
  }) => {
    await page.goto('/en/privacy/');
    await expect(
      page.getByRole('heading', { name: 'Search inside PDFs' }),
    ).toBeVisible();
    await expect(
      page.getByText('not saved, not written to logs'),
    ).toBeVisible();
    await page.goto('/my/privacy/');
    await expect(
      page.getByRole('heading', { name: 'PDF ထဲတွင် ရှာဖွေခြင်း' }),
    ).toBeVisible();
  });

  test('the section works on a narrow screen without sideways scrolling', async ({
    page,
  }) => {
    await page.route('**/api/search?*', (route) => ok(route, [hit(1), hit(2)]));
    await page.goto('/en/dhamma-library/?pdf=truths');
    await expect(page.locator('[data-book-hit]')).toHaveCount(2);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
