import { expect, test, type Page } from '@playwright/test';

// The meditation bell's Timer (docs/meditation-bell.md §3). The clock is faked, so a 20-minute
// countdown finishes in milliseconds. Built always; linked only with PUBLIC_MINI_APPS.
test.use({ timezoneId: 'America/Los_Angeles' });

const start = new Date('2026-11-25T19:00:00-08:00');
const url = '/en/mini-apps/meditation-bell/';

async function open(page: Page, path = url) {
  await page.clock.install({ time: start });
  await page.goto(path);
  await expect(
    page.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
}

const time = (page: Page) => page.getByTestId('bell-time');
const status = (page: Page) => page.getByTestId('bell-status');

test('shows the countdown with English buttons in both locales', async ({
  page,
}) => {
  for (const code of ['en', 'my']) {
    await open(page, `/${code}/mini-apps/meditation-bell/`);
    await expect(time(page)).toHaveText('20:00');
    await expect(status(page)).toHaveText('Ready');
    for (const name of [
      'Start',
      'Reset',
      'Ring bell now',
      'Countdown',
      'Set alarm',
    ])
      await expect(page.getByRole('button', { name })).toBeVisible();
    // Every action button has an icon next to its word.
    await expect(page.locator('.bell-actions .btn svg')).toHaveCount(3);
  }
});

test('a preset sets the length and a 5 minute countdown rings at the end', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await expect(time(page)).toHaveText('05:00');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(status(page)).toHaveText('Sitting');
  await page.clock.runFor('02:00');
  await expect(time(page)).toHaveText('03:00');
  await page.clock.runFor('03:02');
  await expect(status(page)).toHaveText('Bell rang');
  await expect(time(page)).toHaveText('00:00');
});

test('custom minutes accept 1 to 960 and anything else shows an error and starts nothing', async ({
  page,
}) => {
  await open(page);
  const field = page.getByLabel('Custom minutes');
  for (const bad of ['0', '961', '1.5', 'abc', '']) {
    await field.fill(bad);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('#bell-error')).toHaveText(
      'Enter whole minutes from 1 to 960.',
    );
    await expect(status(page)).toHaveText('Ready');
  }
  await field.fill('960');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(time(page)).toHaveText('960:00');
  await expect(page.locator('#bell-error')).toHaveCount(0);
});

test('the Burmese error message is translated', async ({ page }) => {
  await open(page, '/my/mini-apps/meditation-bell/');
  await page.getByLabel('Custom minutes').fill('0');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#bell-error')).toContainText('မိနစ်');
});

test('pause keeps the time left and resume carries on', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '3 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.runFor('01:00');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(status(page)).toHaveText('Paused');
  const left = await time(page).textContent();
  await page.clock.runFor('10:00');
  await expect(time(page)).toHaveText(left ?? '');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor('02:05');
  await expect(status(page)).toHaveText('Bell rang');
});

test('reset returns to the chosen length', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '10 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.runFor('01:00');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(time(page)).toHaveText('10:00');
  await expect(status(page)).toHaveText('Ready');
});

test('a reload during a countdown resumes it', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.runFor('01:00');
  await page.clock.install({ time: new Date(start.getTime() + 60_000) });
  await page.reload();
  await expect(
    page.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  await expect(status(page)).toHaveText('Sitting');
  await expect(time(page)).toHaveText('04:00');
  await page.clock.runFor('04:05');
  await expect(status(page)).toHaveText('Bell rang');
});

test('a bell missed while the page was closed is not rung and says so', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Back 20 minutes later: well past the two-minute allowance.
  await page.clock.install({ time: new Date(start.getTime() + 25 * 60_000) });
  await page.reload();
  await expect(status(page)).toHaveText('Bell missed');
  await expect(page.locator('.bell-notice')).toContainText(
    '7:05 PM bell was missed',
  );
});

test('a bell due two minutes ago or less still rings on return', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.install({ time: new Date(start.getTime() + 6 * 60_000) });
  await page.reload();
  await expect(status(page)).toHaveText('Bell rang');
  await expect(page.locator('.bell-notice')).toHaveCount(0);
});

test('the alarm rings tomorrow for a time that has passed and refuses one over 16 hours away', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await page.getByLabel('Ring at').fill('14:00');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#bell-error')).toHaveText(
    'Pick a time within the next 16 hours.',
  );
  await expect(status(page)).toHaveText('Ready');
  await page.getByLabel('Ring at').fill('06:00');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(status(page)).toHaveText('Sitting');
  await expect(time(page)).toHaveText('6:00 AM');
  await expect(page.locator('.bell-clock__line')).toContainText(
    /Rings tomorrow, in (659|660):/,
  );
});

test('an alarm preset sets the clock to now plus the minutes', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await page.getByRole('button', { name: '+30 min', exact: true }).click();
  await expect(page.getByLabel('Ring at')).toHaveValue('19:30');
  await expect(time(page)).toHaveText('7:30 PM');
});

test('the bell settings panel saves a choice, plays it and shows a notice', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Bells', exact: true }).click();
  await page
    .getByRole('group', { name: 'Rings' })
    .getByRole('button', { name: /2x$/ })
    .click();
  await expect(page.locator('.bell-notice')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Bells', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Rings' })
      .getByRole('button', { name: /2x$/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#bell-start-sound').selectOption('off');
  await page.reload();
  await page.getByRole('button', { name: 'Bells', exact: true }).click();
  await expect(page.locator('#bell-start-sound')).toHaveValue('off');
});

test('Ring bell now works with nothing running and breaks nothing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page
    .getByRole('button', { name: 'Ring bell now', exact: true })
    .click();
  await expect(status(page)).toHaveText('Ready');
  expect(errors).toEqual([]);
});

test('leaving asks first while a timer runs, and not when it is stopped', async ({
  page,
}) => {
  await open(page);
  const back = page.locator('[data-mini-bar] a[href="/en/mini-apps/"]');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-mini-app-busy',
    'true',
  );
  let asked = 0;
  page.once('dialog', (dialog) => {
    asked++;
    void dialog.dismiss();
  });
  await back.click();
  expect(asked).toBe(1);
  await expect(page).toHaveURL(/meditation-bell\/$/);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-mini-app-busy',
    'false',
  );
  await back.click();
  await expect(page).toHaveURL(/\/en\/mini-apps\/$/);
});

test('an unreadable saved value is kept aside and the bell starts fresh with a notice', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('winmetta.meditationBell', '{"version":99}'),
  );
  await open(page);
  await expect(page.locator('.bell-notice')).toContainText('could not be read');
  expect(
    await page.evaluate(() =>
      localStorage.getItem('winmetta.meditationBell.backup'),
    ),
  ).toBe('{"version":99}');
  await expect(time(page)).toHaveText('20:00');
});

test('no request leaves the browser except the page itself', async ({
  page,
}) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (
      !['localhost', '127.0.0.1'].includes(u.hostname) &&
      u.protocol.startsWith('http')
    )
      outside.push(r.url());
  });
  await open(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ring bell now', exact: true })
    .click();
  expect(outside.filter((u) => !u.includes('analytics.example.test'))).toEqual(
    [],
  );
});

test('there is no horizontal scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page);
  await page.getByRole('button', { name: 'Bells', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
