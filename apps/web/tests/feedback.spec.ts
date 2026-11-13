import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

const enabled = process.env.PUBLIC_FEEDBACK === 'true';
const dialog = (page: Page) => page.locator('[data-feedback-dialog]');
const footerLink = (page: Page) => page.locator('footer [data-feedback]');

test('feedback is absent when its build flag is off', async ({ page }) => {
  test.skip(enabled);
  await page.goto('/en/');
  await expect(page.locator('[data-feedback-dialog]')).toHaveCount(0);
  await expect(page.locator('[data-feedback]')).toHaveCount(0);
});

test.describe('feedback enabled', () => {
  test.skip(!enabled);
  for (const locale of ['en', 'my']) {
    test(`feedback ${locale}: canonical context, keyboard, success and no new storage`, async ({
      page,
    }) => {
      const requests: Record<string, unknown>[] = [];
      // Checked after the submit: an assertion thrown inside the route handler would leave the
      // request unfulfilled and fail by timeout instead of with this comparison.
      const hashes: { sent: string | undefined; expected: string }[] = [];
      await page.route('**/api/feedback', async (route) => {
        const request = route.request();
        hashes.push({
          sent: request.headers()['x-amz-content-sha256'],
          expected: createHash('sha256')
            .update(request.postData() ?? '')
            .digest('hex'),
        });
        requests.push(request.postDataJSON());
        await route.fulfill({ status: 204 });
      });
      await page.goto(
        `/${locale}/dhamma-library/?q=private-search#private-fragment`,
      );
      // Existing post-language preferences are unrelated to feedback.
      const before = await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
        cookies: document.cookie,
      }));
      await footerLink(page).focus();
      await page.keyboard.press('Enter');
      await expect(dialog(page)).toBeVisible();
      const opener = footerLink(page);
      await dialog(page).locator('[data-feedback-close]').focus();
      await page.keyboard.press('Shift+Tab');
      const focusInside = await dialog(page).evaluate((node) =>
        node.contains(document.activeElement),
      );
      expect(focusInside).toBe(true);
      await dialog(page)
        .locator('[name=message]')
        .fill('Please check this page.');
      await dialog(page).locator('[name=email]').fill('reporter@example.org');
      await expect(dialog(page).locator('[type=submit]')).toBeEnabled();
      await dialog(page).locator('[type=submit]').click();
      await expect(dialog(page).locator('form')).toBeHidden();
      expect(requests).toHaveLength(1);
      expect(hashes[0]?.sent).toBe(hashes[0]?.expected);
      expect(requests[0]).toMatchObject({
        ctx: 'general',
        type: 'suggestion',
        page: `/${locale}/dhamma-library/`,
        locale,
        message: 'Please check this page.',
        email: 'reporter@example.org',
      });
      expect(JSON.stringify(requests)).not.toContain('private-');
      await page.keyboard.press('Escape');
      await expect(dialog(page)).not.toBeVisible();
      await expect(opener).toBeFocused();
      const after = await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
        cookies: document.cookie,
      }));
      expect(after).toEqual(before);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }

  test('feedback keeps the draft on failure and supplies the email fallback', async ({
    page,
  }) => {
    await page.route('**/api/feedback', (route) =>
      route.fulfill({ status: 503 }),
    );
    await page.goto('/en/classes/');
    await page.locator('[data-feedback-item=schedule]').click();
    await expect(dialog(page).locator('[name=type] option')).toHaveCount(5);
    await dialog(page).locator('[name=type]').selectOption('time');
    await dialog(page)
      .locator('[name=message]')
      .fill('A correction to the class time.');
    await expect(dialog(page).locator('[type=submit]')).toBeEnabled();
    await dialog(page).locator('[type=submit]').click();
    await expect(dialog(page).locator('[data-feedback-status]')).toContainText(
      'could not send',
    );
    await expect(dialog(page).locator('[name=message]')).toHaveValue(
      'A correction to the class time.',
    );
    await expect(
      dialog(page).locator('[data-feedback-fallback]'),
    ).toHaveAttribute('href', /^mailto:feedback@winmetta.org\?/);
  });

  test('feedback post language and Sādhu work without analytics', async ({
    page,
  }) => {
    test.skip(process.env.PUBLIC_FEEDBACK_POSTS_REVIEWED !== 'true');
    await page.goto('/en/dhamma-posts/');
    const href = await page
      .locator('[data-post-list] a[data-card-link]')
      .first()
      .getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href! + '?lang=en,zh');
    const sadhu = page.locator('[data-sadhu]');
    await sadhu.click();
    await expect(sadhu).toBeDisabled();
    await expect(page.locator('[data-sadhu-status]')).toContainText(
      'Thank you',
    );
    await page.locator('[data-feedback-lang=zh-Hans]').click();
    await expect(dialog(page).locator('[data-feedback-about]')).toContainText(
      'zh-Hans',
    );
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('[data-sadhu]')).toBeEnabled();
  });

  test('feedback works on hydrated library and retreat cards', async ({
    page,
  }) => {
    await page.goto('/en/dhamma-library/?q=' + encodeURIComponent('ဓမ္မပဒ'));
    const book = page.locator('[data-feedback=library]').first();
    await book.click();
    await expect(dialog(page).locator('[name=type] option')).toHaveCount(3);
    await expect(dialog(page).locator('[data-feedback-about]')).toContainText(
      '/en/dhamma-library/',
    );
    await page.keyboard.press('Escape');
    await page.goto('/en/classes/retreats/');
    await page.locator('[data-feedback=class]').first().click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('[name=type] option')).toHaveCount(5);
  });

  test('feedback analytics contain only fixed labels and outcomes', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const events: { name: string; data: unknown }[] = [];
      Object.assign(window, {
        __feedbackEvents: events,
        umami: {
          track: (name: string, data: unknown) => events.push({ name, data }),
        },
      });
    });
    await page.route('**/api/feedback', (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto('/en/about/');
    await footerLink(page).click();
    await dialog(page).locator('[name=message]').fill('A private message.');
    await dialog(page).locator('[name=email]').fill('reporter@example.org');
    await expect(dialog(page).locator('[type=submit]')).toBeEnabled();
    await dialog(page).locator('[type=submit]').click();
    await expect(dialog(page).locator('form')).toBeHidden();
    const events = await page.evaluate(
      () =>
        (window as unknown as { __feedbackEvents: unknown[] }).__feedbackEvents,
    );
    expect(events).toEqual([
      { name: 'feedback_open', data: { ctx: 'general' } },
      {
        name: 'feedback_submit',
        data: { ctx: 'general', type: 'suggestion', ok: true },
      },
    ]);
  });

  test('feedback links work without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto('/my/classes/');
      await expect(footerLink(page)).toHaveAttribute(
        'href',
        /^mailto:feedback@winmetta.org\?/,
      );
      await expect(
        page.locator('[data-feedback-item=schedule]'),
      ).toHaveAttribute('href', /%2Fmy%2Fclasses%2F/);
      await expect(dialog(page)).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
