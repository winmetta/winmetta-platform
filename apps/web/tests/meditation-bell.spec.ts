import { readFile } from 'node:fs/promises';
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
      'Ring now',
      'Timer',
      'Schedule',
      'Set alarm',
    ])
      await expect(page.getByRole('button', { name })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Countdown', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('.bell-actions button svg')).toHaveCount(2);
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
  await page.clock.pauseAt(new Date(start.getTime() + 10_000));
  await page.clock.setSystemTime(new Date(start.getTime() + 25 * 60_000));
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
  await page.clock.pauseAt(new Date(start.getTime() + 10_000));
  await page.clock.setSystemTime(new Date(start.getTime() + 6 * 60_000));
  await page.reload();
  await expect(status(page)).toHaveText('Bell rang');
  await expect(page.locator('.bell-notice')).toHaveCount(0);
});

test('the alarm rings tomorrow for a time that has passed and refuses one over 16 hours away', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Countdown', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set alarm', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(status(page)).toHaveText('Pick a time or a preset');
  await page.getByLabel('Ring at').fill('14:00');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#bell-error')).toHaveText(
    'Pick a time within the next 16 hours.',
  );
  await expect(status(page)).toHaveText('Ready');
  await page.getByLabel('Ring at').fill('06:00');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(status(page)).toHaveText('Alarm set');
  await expect(page.locator('.bell-clock__line')).toHaveText('Rings tomorrow');
  await page.clock.runFor('02:00');
  await expect(time(page)).toHaveText('6:00 AM');
});

test('an alarm preset sets the clock to now plus the minutes', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await page.getByRole('button', { name: '+30 min', exact: true }).click();
  await expect(page.getByLabel('Ring at')).toHaveValue('19:30');
  await expect(time(page)).toHaveText('7:30 PM');
  await page.getByRole('button', { name: 'Countdown', exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set alarm', exact: true }),
  ).toBeVisible();
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

test('Ring now works with nothing running and breaks nothing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.getByRole('button', { name: 'Ring now', exact: true }).click();
  await expect(status(page)).toHaveText('Ready');
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Weekly schedule' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set alarm', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Ring now', exact: true }).click();
  await page.getByRole('button', { name: 'Timer', exact: true }).click();
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
  await page.getByRole('button', { name: 'Ring now', exact: true }).click();
  expect(outside.filter((u) => !u.includes('analytics.example.test'))).toEqual(
    [],
  );
});

test('the bell controls fit at 320 px and leave space above Ring now', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page);
  const ring = page.getByRole('button', { name: 'Ring now', exact: true });
  await expect(ring).toHaveCSS('min-height', '56px');
  await expect(ring).toHaveCSS('margin-top', '24px');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.getByRole('button', { name: 'Bells', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: 'Bells', exact: true }).click();
    await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: 'Countdown', exact: true }).click();
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    const days = page.getByRole('group', { name: 'Days' }).getByRole('button');
    await expect(days).toHaveCount(7);
    const sunday = await days.last().boundingBox();
    expect(sunday).not.toBeNull();
    expect(sunday!.x + sunday!.width).toBeLessThanOrEqual(320);
    expect(sunday!.width).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await expect(ring).toHaveCSS(
      'color',
      colorScheme === 'light' ? 'rgb(38, 79, 99)' : 'rgb(189, 210, 220)',
    );
    await page.getByRole('button', { name: 'Timer', exact: true }).click();
  }
});

test('weekly bells can be added on multiple days, moved, and deleted', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Choose a time.');
  await page.getByLabel('Time', { exact: true }).fill('06:00');
  await page.getByLabel('Label (optional)').fill('Morning sitting');
  await page.getByRole('button', { name: 'Weekdays', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /6:00 AM Morning sitting/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Time', { exact: true }).fill('06:00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'A bell at 6:00 AM is already set on Monday.',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Friday', exact: true }).click();
  await page.getByRole('button', { name: /6:00 AM Morning sitting/ }).click();
  await page.getByLabel('Time', { exact: true }).fill('07:30');
  await page.getByRole('button', { name: 'Sunday', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Sunday', exact: true }).click();
  await page.getByRole('button', { name: /7:30 AM Morning sitting/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByText('No bells on Sunday.')).toBeVisible();
  await page.getByRole('button', { name: 'Monday', exact: true }).click();
  await expect(page.getByText('No bells on Monday.')).toBeVisible();
});

test('the Timer and Schedule only stop each other after confirmation', async ({
  page,
}) => {
  await open(page);
  const timer = page.getByRole('button', { name: 'Timer', exact: true });
  const schedule = page.getByRole('button', { name: 'Schedule', exact: true });
  const toggle = page.getByRole('switch', { name: 'Weekly schedule' });
  const dialog = page.getByRole('alertdialog');
  await schedule.click();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await timer.click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(status(page)).toHaveText('Ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await dialog.getByRole('button', { name: 'Turn off and start' }).click();
  await expect(status(page)).toHaveText('Sitting');
  await schedule.click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await dialog.getByRole('button', { name: 'Stop timer and turn on' }).click();
  await expect(toggle).toBeChecked();
  await timer.click();
  await expect(status(page)).toHaveText('Ready');
});

test('CSV previews skipped rows and fallback sounds, adds or replaces, and downloads UTF-8 with a BOM', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  const choose = async (contents: string) => {
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.getByLabel('Choose CSV file').setInputFiles({
      name: 'sittings.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(contents),
    });
  };
  const header = 'day,time,label,sound,rings\n';
  await choose(
    header + 'Mon,06:00,"နံနက်, sitting",bad,2\nTue,99:00,Invalid,,1\n',
  );
  await expect(
    page.getByRole('heading', { name: 'Import preview' }),
  ).toBeVisible();
  await expect(page.getByText('1 will use your end bell sound.')).toBeVisible();
  await expect(page.getByText(/Row 3: Invalid time/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Add to the current schedule' })
    .click();
  await expect(
    page.getByRole('button', { name: /6:00 AM နံနက်, sitting/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await choose(
    header +
      'Mon,06:00,Duplicate,winmetta-short,1\nMon,07:15,Second,winmetta-short,1\n',
  );
  await page
    .getByRole('button', { name: 'Add to the current schedule' })
    .click();
  await expect(page.getByText('Imported 1. Skipped 1.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('winmetta-bell-schedule.csv');
  const contents = await readFile(await download.path(), 'utf8');
  expect(contents.charCodeAt(0)).toBe(0xfeff);
  expect(contents).toContain('Mon,06:00,"နံနက်, sitting",winmetta-long,2');
  expect(contents).toContain('Mon,07:15,Second,winmetta-short,1');
  await choose(header + 'Mon,08:00,Replacement,winmetta-long,1\n');
  await page
    .getByRole('button', { name: 'Replace the whole schedule' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel' })
    .click();
  await page
    .getByRole('button', { name: 'Replace the whole schedule' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Replace the whole schedule' })
    .click();
  await expect(
    page.getByRole('button', { name: /8:00 AM Replacement/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Morning|Second|နံနက်/ }),
  ).toHaveCount(0);
});

test('a scheduled bell rings at its wall-clock time and an older missed bell is reported after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      const root = document.documentElement;
      root.dataset.oscillators = String(
        Number(root.dataset.oscillators ?? '0') + 1,
      );
      return original.apply(this, args);
    };
  });
  await open(page);
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Wednesday', exact: true }).click();
  for (const time of ['19:01', '19:02']) {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Time', { exact: true }).fill(time);
    await page.getByLabel('Rings', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  }
  await page.getByRole('switch', { name: 'Weekly schedule' }).click();
  await expect(page.getByRole('button', { name: 'Enable sound' })).toHaveCount(
    0,
  );
  await page.clock.runFor('01:03');
  await expect(page.locator('html')).toHaveAttribute('data-oscillators', '5');
  await page.clock.pauseAt(new Date(start.getTime() + 70_000));
  await page.clock.setSystemTime(new Date(start.getTime() + 5 * 60_000 + 1000));
  await page.reload();
  await page.getByRole('button', { name: 'Enable sound' }).click();
  await expect(
    page.getByText('Your Wednesday 7:02 PM bell was missed.'),
  ).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-oscillators',
    /.+/,
  );
});
