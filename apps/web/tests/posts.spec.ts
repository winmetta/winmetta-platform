import { expect, test, type Page } from '@playwright/test';
import { siteOrigin } from './site';

const post = '2026-10-11-meaning-of-vidhi-and-anuvada';
const other = '2026-10-11-what-is-a-sekkha-person-sekkha-puggala';
const visibleSections = (page: Page) =>
  page
    .locator('section[data-post-lang]:visible')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('lang') ?? ''),
    );

test.describe('Dhamma posts', () => {
  test('the index lists topics and all posts, newest first', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-posts/');
    await expect(page.locator('h1')).toHaveText('Dhamma Posts');
    // No separate "Recent posts" list: all posts are already newest first.
    await expect(page.locator('section[aria-labelledby="recent"]')).toHaveCount(
      0,
    );
    await expect(page.locator('[data-post-list]')).toHaveCount(1);
    const all = page.locator('[data-post-list] > li');
    const created = await all.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.created ?? ''),
    );
    expect(created).toEqual([...created].sort().reverse());
    const ids = await all.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.id),
    );
    // 9 posts fit on one page of 50: no pager.
    await expect(page.locator('nav .pager')).toHaveCount(0);
    // "Oldest first" is its own page, so it can be shared and works without JavaScript.
    await page.getByRole('link', { name: 'Oldest first' }).click();
    await expect(page).toHaveURL(/\/en\/dhamma-posts\/oldest\/$/);
    await expect(
      page.getByRole('link', { name: 'Oldest first' }),
    ).toHaveAttribute('aria-current', 'page');
    const oldest = await all.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.id),
    );
    expect(oldest).toEqual([...ids].reverse());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${siteOrigin}/en/dhamma-posts/oldest/`,
    );
  });

  test('"oldest first" pages stay out of search results and the sitemap', async ({
    page,
    request,
  }) => {
    await page.goto('/en/dhamma-posts/oldest/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).toContain('/en/dhamma-posts/</loc>');
    expect(sitemap).toContain('/en/dhamma-posts/tags/lobha/</loc>');
    expect(sitemap).not.toContain('/oldest/');
  });

  test('oldest first works without JavaScript, on tag pages too', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en/dhamma-posts/tags/lobha/');
    await page.getByRole('link', { name: 'Oldest first' }).click();
    await expect(page).toHaveURL(/\/en\/dhamma-posts\/tags\/lobha\/oldest\/$/);
    const created = await page
      .locator('[data-post-list] > li')
      .evaluateAll((items) =>
        items.map((item) => (item as HTMLElement).dataset.created ?? ''),
      );
    expect(created).toEqual([...created].sort());
    await context.close();
  });

  test('?lang= opens a post in those languages, shows them pressed and remembers them', async ({
    page,
  }) => {
    await page.goto(`/my/dhamma-posts/${post}/?lang=en,zh`);
    expect(await visibleSections(page)).toEqual(['en', 'zh-Hans']);
    for (const [lang, pressed] of [
      ['my', 'false'],
      ['en', 'true'],
      ['zh-Hans', 'true'],
    ] as const)
      await expect(
        page.locator(`[data-post-lang-toggle="${lang}"]`),
      ).toHaveAttribute('aria-pressed', pressed);
    await page.goto(`/my/dhamma-posts/${other}/`);
    expect(await visibleSections(page)).toEqual(['en', 'zh-Hans']);
  });

  test('"Read in" buttons write ?lang= in the address, on posts and tag pages', async ({
    page,
  }) => {
    await page.goto(`/en/dhamma-posts/${post}/`);
    await page.locator('[data-post-lang-toggle="zh-Hans"]').click();
    await page.locator('[data-post-lang-toggle="my"]').click();
    await expect(page).toHaveURL(/\?lang=my,en,zh$/);
    await page.goto('/en/dhamma-posts/tags/kusala/');
    await page.locator('[data-post-lang-toggle="en"]').click();
    await expect(page).toHaveURL(/\/tags\/kusala\/\?lang=my,zh$/);
    // The interface language switch keeps it.
    await page.locator('a[data-locale="my"]').click();
    await expect(page).toHaveURL(
      /\/my\/dhamma-posts\/tags\/kusala\/\?lang=my,zh$/,
    );
    // Wait for the new page's picker script to mark the buttons (a one-off read can run first).
    for (const [lang, pressed] of [
      ['my', 'true'],
      ['en', 'false'],
      ['zh-Hans', 'true'],
    ] as const)
      await expect(
        page.locator(`[data-post-lang-toggle="${lang}"]`),
      ).toHaveAttribute('aria-pressed', pressed);
  });

  test('a tag page lists only posts with that tag', async ({ page }) => {
    await page.goto('/en/dhamma-posts/');
    await page.locator('a.chip[href="/en/dhamma-posts/tags/lobha/"]').click();
    await expect(page).toHaveURL(/\/en\/dhamma-posts\/tags\/lobha\/$/);
    await expect(page.locator('h1')).toHaveText('Posts on “Lobha”');
    const items = page.locator('[data-post-list] > li');
    await expect(items).toHaveCount(5);
    const ids = await items.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).dataset.id).sort(),
    );
    expect(ids).toEqual([
      '2026-10-11-guidance-on-overcoming-greed',
      '2026-10-11-study-on-greed-lobha-and-various-metaphors',
      '2026-10-11-synonyms-of-lobha-greed-attachment',
      '2026-10-11-the-four-characteristics-tetrad-of-greed-lobha',
      '2026-10-11-understanding-lobha-raga-and-tanha',
    ]);
    // Lists show titles only; tags are on the post page.
    await expect(page.locator('[data-post-list] .tag')).toHaveCount(0);
  });

  test('a tag page links to related topics from its posts', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-posts/tags/kusala/');
    const related = page.locator(
      'section[aria-labelledby="related-topics"] a.chip',
    );
    await expect(page.locator('#related-topics')).toHaveText('Related topics');
    await expect(related).toHaveCount(1);
    await expect(related.first()).toHaveAttribute(
      'href',
      '/en/dhamma-posts/tags/kamma/',
    );
    await expect(related.first()).toContainText('Kamma');
    await related.first().click();
    await expect(page).toHaveURL(/\/en\/dhamma-posts\/tags\/kamma\/$/);
    // Most shared first: Pāḷi terms is on two of the five Lobha posts.
    await page.goto('/en/dhamma-posts/tags/lobha/');
    await expect(
      page.locator('section[aria-labelledby="related-topics"] a.chip').first(),
    ).toHaveAttribute('href', '/en/dhamma-posts/tags/pali-terms/');
  });

  test('a post shows the interface language first, by default', async ({
    page,
  }) => {
    await page.goto(`/my/dhamma-posts/${post}/`);
    expect(await visibleSections(page)).toEqual(['my']);
    await page.goto(`/en/dhamma-posts/${post}/`);
    expect(await visibleSections(page)).toEqual(['en']);
    await expect(page).toHaveTitle('Meaning of Vidhi and Anuvāda · Win Metta');
  });

  test('chosen languages keep the Burmese, English, Chinese order and are remembered', async ({
    page,
  }) => {
    await page.goto(`/my/dhamma-posts/${post}/`);
    const toggle = (lang: string) =>
      page.locator(`[data-post-lang-toggle="${lang}"]`);
    await toggle('zh-Hans').click();
    await toggle('en').click();
    expect(await visibleSections(page)).toEqual(['my', 'en', 'zh-Hans']);
    await toggle('my').click();
    expect(await visibleSections(page)).toEqual(['en', 'zh-Hans']);
    // Another post, and the list titles, use the same choice.
    await page.goto(`/my/dhamma-posts/${other}/`);
    expect(await visibleSections(page)).toEqual(['en', 'zh-Hans']);
    await page.goto('/my/dhamma-posts/');
    const titles = page.locator(
      `[data-post-list] li[data-id="${other}"] [data-post-lang]:visible`,
    );
    await expect(titles).toHaveCount(2);
    await expect(titles.first()).toHaveAttribute('lang', 'en');
  });

  test('each language shows its own tag names above its title, all linking to the English slug', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'winmetta.postLanguages',
        JSON.stringify(['my', 'zh-Hans']),
      ),
    );
    await page.goto(`/my/dhamma-posts/${other}/`);
    for (const [lang, names] of [
      ['my', ['အရိယာ', 'ပါဠိ ဝေါဟာရ']],
      ['zh-Hans', ['圣者', '巴利术语']],
    ] as const) {
      const section = page.locator(`section[data-post-lang="${lang}"]`);
      const tags = section.locator('ul.post-tags a.tag');
      await expect(tags).toHaveText([...names]);
      await expect(tags.first()).toHaveAttribute(
        'href',
        '/my/dhamma-posts/tags/ariya/',
      );
      // The tag list comes before the title.
      expect(
        await section.evaluate((element) => {
          const list = element.querySelector('ul.post-tags');
          const title = element.querySelector('h2');
          return Boolean(
            list &&
            title &&
            list.compareDocumentPosition(title) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }),
      ).toBe(true);
    }
    await page
      .locator('section[data-post-lang="zh-Hans"] a.tag', { hasText: '圣者' })
      .click();
    await expect(page).toHaveURL(/\/my\/dhamma-posts\/tags\/ariya\/$/);
  });

  test('the last chosen language cannot be turned off', async ({ page }) => {
    await page.goto(`/en/dhamma-posts/${post}/`);
    const english = page.locator('[data-post-lang-toggle="en"]');
    await expect(english).toHaveAttribute('aria-disabled', 'true');
    // Playwright treats aria-disabled as disabled; force the click a reader could still make.
    await english.click({ force: true });
    expect(await visibleSections(page)).toEqual(['en']);
    await expect(english).toHaveAttribute('aria-pressed', 'true');
  });

  test('share on a tag page copies its address with the chosen languages', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('/en/dhamma-posts/tags/lobha/?lang=my,en');
    await expect(page.getByRole('button', { name: 'Print' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.locator('.toast[role="status"]')).toHaveText(
      'Link copied',
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${siteOrigin}/en/dhamma-posts/tags/lobha/?lang=my,en`,
    );
  });

  test('share on the posts index copies its address with the chosen languages', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('/my/dhamma-posts/oldest/?lang=my,zh');
    await expect(page.locator('.post-toolbar')).toHaveCount(1);
    await expect(page.locator('[data-print]')).toHaveCount(0);
    await page.locator('[data-share]').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${siteOrigin}/my/dhamma-posts/oldest/?lang=my,zh`,
    );
  });

  test('share on the posts index includes the active search, and only there', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    const copied = () => page.evaluate(() => navigator.clipboard.readText());
    await page.goto('/en/dhamma-posts/?lang=my,en');
    // Share right after typing: leaving the box writes the query to the address first.
    await page.getByLabel('Search posts').fill('kamma');
    await page.locator('[data-share]').click();
    await expect
      .poll(copied)
      .toBe(`${siteOrigin}/en/dhamma-posts/?q=kamma&lang=my,en`);
    // Cleared search: the plain page again.
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.locator('[data-share]').click();
    await expect.poll(copied).toBe(`${siteOrigin}/en/dhamma-posts/?lang=my,en`);
    // Tag and post pages have no search, so a stray ?q= is not shared.
    await page.goto('/en/dhamma-posts/tags/lobha/?q=kamma&lang=en');
    await page.locator('[data-share]').click();
    await expect
      .poll(copied)
      .toBe(`${siteOrigin}/en/dhamma-posts/tags/lobha/?lang=en`);
  });

  test('share copies the post address', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      // Use the copy path on every device in tests (no system share sheet).
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto(`/en/dhamma-posts/${post}/`);
    await page.getByRole('button', { name: 'Share' }).click();
    // A temporary toast, not text in the toolbar.
    const toast = page.locator('.toast[role="status"]');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText('Link copied');
    await expect(toast).toHaveCSS('position', 'fixed');
    await expect(page.locator('.post-toolbar')).not.toContainText(
      'Link copied',
    );
    // Always with the languages on screen, so the link opens the same way.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${siteOrigin}/en/dhamma-posts/${post}/?lang=en`,
    );
    await expect(toast).toBeHidden({ timeout: 5000 });
  });

  test('printing hides the site header, footer and controls', async ({
    page,
  }) => {
    await page.goto(`/en/dhamma-posts/${post}/`);
    await page.locator('[data-post-lang-toggle="my"]').click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('header.site-header')).toBeHidden();
    await expect(page.locator('footer.site-footer')).toBeHidden();
    await expect(page.locator('.post-toolbar')).toBeHidden();
    await expect(page.locator('.print-only')).toBeVisible();
    expect(await visibleSections(page)).toEqual(['my', 'en']);
  });

  test('without JavaScript every language shows', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/en/dhamma-posts/${post}/`);
    expect(await visibleSections(page)).toEqual(['my', 'en', 'zh-Hans']);
    await expect(page.locator('.post-picker')).toBeHidden();
    await context.close();
  });

  test.describe('search', () => {
    const resultIds = (page: Page) =>
      page
        .locator('[data-search-exact] > li')
        .evaluateAll((items) =>
          items.map((item) => (item as HTMLElement).dataset.id),
        );

    test('loads nothing until the box is used', async ({ page }) => {
      const requests: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      await page.goto('/en/dhamma-posts/');
      await page.waitForLoadState('networkidle');
      expect(requests.filter((url) => url.includes('/post-data/'))).toEqual([]);
      await page.getByLabel('Search posts').focus();
      await expect
        .poll(
          () => requests.filter((url) => url.includes('/post-data/')).length,
        )
        .toBe(2);
    });

    test('shows results instead of the lists, in the Read-in languages, and keeps ?lang=', async ({
      page,
    }) => {
      await page.goto('/en/dhamma-posts/?lang=en,zh');
      await page.getByLabel('Search posts').fill('Sekkha');
      await expect(page.locator('[data-search-status]')).toHaveText(
        'Results: 1',
      );
      expect(await resultIds(page)).toEqual([other]);
      await expect(page.locator('[data-post-browse]').first()).toBeHidden();
      await expect(page).toHaveURL(/\?q=Sekkha&lang=en,zh$/);
      const titles = page.locator(
        '[data-search-exact] [data-post-lang]:visible',
      );
      expect(
        await titles.evaluateAll((spans) =>
          spans.map((span) => span.getAttribute('lang')),
        ),
      ).toEqual(['en', 'zh-Hans']);
      await expect(
        page.locator('[data-search-exact] a[data-card-link]'),
      ).toHaveAttribute('href', `/en/dhamma-posts/${other}/`);
      // Changing "Read in" keeps the search in the address.
      await page.locator('[data-post-lang-toggle="my"]').click();
      await expect(page).toHaveURL(/\?q=Sekkha&lang=my,en,zh$/);
    });

    test('a link with ?q= searches on load, and the language switch keeps it', async ({
      page,
    }) => {
      await page.goto('/my/dhamma-posts/?q=%E8%B2%AA');
      await expect(page.getByLabel('ဆောင်းပါးများ ရှာဖွေရန်')).toHaveValue(
        '貪',
      );
      // Traditional 貪 finds the Simplified 贪 in every Lobha post.
      await expect
        .poll(async () => (await resultIds(page)).length)
        .toBeGreaterThanOrEqual(5);
      await page.locator('a[data-locale="en"]').click();
      await expect(page).toHaveURL(/\/en\/dhamma-posts\/\?q=%E8%B2%AA$/);
      await expect(page.getByLabel('Search posts')).toHaveValue('貪');
    });

    test('Clear search and Escape bring the lists back', async ({ page }) => {
      await page.goto('/en/dhamma-posts/?q=lobha');
      await expect(
        page.locator('[data-search-exact] > li').first(),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(page.locator('[data-post-browse]').first()).toBeVisible();
      await expect(page.locator('[data-search-results]')).toBeHidden();
      await expect(page).toHaveURL(/\/en\/dhamma-posts\/$/);
      const box = page.getByLabel('Search posts');
      await box.fill('kamma');
      await expect(page.locator('[data-search-results]')).toBeVisible();
      await box.press('Escape');
      await expect(page.locator('[data-search-results]')).toBeHidden();
    });

    test('says so when nothing matches', async ({ page }) => {
      await page.goto('/en/dhamma-posts/?q=zzqqxx');
      await expect(page.locator('[data-search-status]')).toHaveText(
        /^No posts found/,
      );
    });

    test('without JavaScript the box is replaced by a note', async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const noJs = await context.newPage();
      await noJs.goto('/en/dhamma-posts/');
      await expect(noJs.locator('[data-search-form]')).toBeHidden();
      // Playwright stops scripts but still parses <noscript> as if scripting were on, so check
      // the note is in the page rather than that it renders.
      expect(
        await noJs
          .locator('noscript')
          .first()
          .evaluate((el) => el.innerHTML),
      ).toContain('Search needs JavaScript');
      await expect(noJs.locator('[data-post-list] > li').first()).toBeVisible();
      await context.close();
    });
  });

  test('post pages do not scroll sideways', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'winmetta.postLanguages',
        JSON.stringify(['my', 'en', 'zh-Hans']),
      ),
    );
    for (const path of [
      `/my/dhamma-posts/${post}/`,
      '/my/dhamma-posts/2026-10-11-synonyms-of-lobha-greed-attachment/',
      '/my/dhamma-posts/',
      '/my/dhamma-posts/?q=%E1%80%9C%E1%80%B1%E1%80%AC%E1%80%98',
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
});
