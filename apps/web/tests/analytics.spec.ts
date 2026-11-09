import { expect, test, type Page } from '@playwright/test';

// The tracker is off unless the build sets PUBLIC_ANALYTICS=true and a website id (docs/analytics.md).
// Run the "on" tests against such a build with ANALYTICS_BUILD=true; the default build and the
// post-deploy check (BASE_URL) skip the "off" test, because production has the tracker on.
const onBuild = process.env.ANALYTICS_BUILD === 'true';
const host = 'https://stats.app.winmetta.org';

interface Tracker {
  attrs: Record<string, string>;
  sent: Record<string, unknown>;
}
interface Seen {
  __tracker?: Tracker;
  __events?: { name: string; data?: unknown }[];
}

async function trackerOf(page: Page): Promise<Tracker> {
  await page.waitForFunction(() => '__tracker' in window);
  const t = await page.evaluate(() => (window as Seen).__tracker);
  if (!t) throw new Error('the stub tracker did not run');
  return t;
}

// Stands in for Umami's script.js: reads its own data-* attributes like the real one and runs
// the before-send hook on a sample payload, so the hook wiring is tested without the network.
const stubTracker = `
(() => {
  const s = document.currentScript;
  const hook = window[s.getAttribute('data-before-send')];
  window.__tracker = {
    attrs: Object.fromEntries([...s.attributes].map((a) => [a.name, a.value])),
    sent: hook('event', {
      screen: '390x844',
      url: location.href + '?q=secret#frag',
      referrer: 'https://www.google.com/search?q=secret',
    }),
  };
  window.umami = { track: (name, data) => (window.__events ??= []).push({ name, data }) };
})();`;

test.describe('tracker off (default build)', () => {
  test.skip(
    onBuild || Boolean(process.env.BASE_URL),
    'a build with analytics on',
  );
  test('loads nothing from the analytics host and has no config element', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    expect(requests.filter((u) => u.startsWith(host))).toEqual([]);
    await expect(page.locator('#analytics-config')).toHaveCount(0);
  });
});

test.describe('tracker on (ANALYTICS_BUILD=true)', () => {
  test.skip(!onBuild, 'needs a build with PUBLIC_ANALYTICS=true');
  test.beforeEach(async ({ page }) => {
    await page.route(`${host}/**`, (route) =>
      route.request().url().endsWith('/script.js')
        ? route.fulfill({ contentType: 'text/javascript', body: stubTracker })
        : route.fulfill({ status: 204, body: '' }),
    );
  });

  test('loads with the privacy options and sanitizes the payload', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-library/?q=secret');
    const t = await trackerOf(page);
    expect(t.attrs).toMatchObject({
      'data-do-not-track': 'true',
      'data-exclude-search': 'true',
      'data-exclude-hash': 'true',
      'data-domains': 'app.winmetta.org',
    });
    expect(t.sent).not.toHaveProperty('screen');
    expect(t.sent.url).toBe('/en/dhamma-library/');
    expect(t.sent.referrer).toBe('https://www.google.com/');
  });

  test('writes no cookie and no storage key', async ({ page }) => {
    await page.goto('/en/');
    await page.waitForFunction(() => '__tracker' in window);
    expect(await page.context().cookies()).toEqual([]);
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    ).toEqual([0, 0]);
  });

  test('does not load the script when Do Not Track is on', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { DNT: '1' },
    });
    const page = await context.newPage();
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }),
    );
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/en/');
    await page.waitForLoadState('networkidle');
    expect(requests.filter((u) => u.startsWith(host))).toEqual([]);
    await context.close();
  });

  test('the 404 page reports one constant path and only a section label', async ({
    page,
  }) => {
    await page.goto('/en/classes/some-typed-name-zzz/');
    const t = await trackerOf(page);
    expect(t.sent.url).toBe('/404/');
    await page.waitForFunction(
      () => ((window as Seen).__events ?? []).length > 0,
    );
    const events = await page.evaluate(() => (window as Seen).__events);
    expect(events).toEqual([
      { name: 'page_not_found', data: { section: 'classes' } },
    ]);
    expect(JSON.stringify(events)).not.toContain('typed');
  });

  // Events the page sent, with navigation by clicked links stopped so the page (and its list) stays.
  const events = (page: Page) =>
    page.evaluate(() => (window as Seen).__events ?? []);
  const stayOnPage = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      document.addEventListener(
        'click',
        (e) => {
          if ((e.target as Element).closest(sel)) e.preventDefault();
        },
        true,
      );
    }, selector);

  test('a language switch reports only from and to', async ({ page }) => {
    await page.goto('/en/');
    await stayOnPage(page, 'a[data-locale]');
    await page.locator('a[data-locale="my"]').click();
    await expect
      .poll(() => events(page))
      .toContainEqual({
        name: 'locale_switch',
        data: { from: 'en', to: 'my' },
      });
  });

  test('a library search sends buckets and labels, never the text', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-library/');
    await stayOnPage(page, 'a.btn');
    const box = page.getByRole('searchbox', { name: 'Search books' });
    await box.fill('ဓမ္မပဒ');
    await expect(
      page.locator('h3', { hasText: 'ဓမ္မပဒ' }).first(),
    ).toBeVisible();
    await page.waitForFunction(() =>
      ((window as Seen).__events ?? []).some(
        (e) => e.name === 'library_search',
      ),
    );
    await page
      .getByRole('link', { name: /Download PDF/ })
      .first()
      .click();
    const seen = await events(page);
    const search = seen.filter((e) => e.name === 'library_search');
    expect(search).toHaveLength(1);
    expect(search[0]?.data).toMatchObject({
      script: 'my',
      similar_shown: expect.any(Boolean),
      zawgyi_suspected: false,
    });
    expect(['0', '1-5', '6-20', 'more']).toContain(
      (search[0]?.data as { results: string }).results,
    );
    expect(seen.find((e) => e.name === 'library_result_click')?.data).toEqual({
      position: '1',
      kind: 'exact',
    });
    expect(
      seen.find((e) => e.name === 'search_index_load')?.data,
    ).toMatchObject({
      area: 'library',
      ok: true,
    });
    expect(JSON.stringify(seen)).not.toContain('ဓမ္မပဒ');
  });

  test('the schedule time zone and a post share are reported', async ({
    page,
  }) => {
    await page.goto('/en/classes/');
    // The time zone select is a React island: change it only after it has hydrated.
    await page.waitForFunction(
      () =>
        document.querySelector(
          'astro-island[component-url*="WeeklySchedule"]',
        ) &&
        !document.querySelector(
          'astro-island[component-url*="WeeklySchedule"][ssr]',
        ),
    );
    await page.getByLabel('Show times in').selectOption('myanmar');
    await expect
      .poll(() => events(page))
      .toContainEqual({
        name: 'class_timezone_change',
        data: { zone: 'myanmar' },
      });
    await page.goto('/en/dhamma-posts/');
    await page.locator('[data-share]').click();
    await expect
      .poll(() => events(page))
      .toContainEqual({
        name: 'post_share',
        data: { kind: 'index' },
      });
  });

  test('opening a post reports its id and languages, and Print reports the id', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-posts/');
    const href = await page
      .locator('a[data-card-link]')
      .first()
      .getAttribute('href');
    await page.goto(href ?? '/');
    await page.waitForFunction(() => '__tracker' in window);
    await expect
      .poll(async () =>
        (await events(page)).some((e) => e.name === 'post_open'),
      )
      .toBe(true);
    const open = (await events(page)).find((e) => e.name === 'post_open');
    expect(open?.data).toMatchObject({
      post: expect.stringMatching(/^\d{4}-\d{2}-\d{2}-/),
    });
    await page.evaluate(() => (window.print = () => {}));
    await page.getByRole('button', { name: 'Print' }).click();
    expect((await events(page)).some((e) => e.name === 'post_print')).toBe(
      true,
    );
  });
});
