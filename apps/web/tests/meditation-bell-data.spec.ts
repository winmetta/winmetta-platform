import { expect, test } from '@playwright/test';
import {
  backupKey,
  defaultState,
  storageKey,
} from '../src/lib/meditation-bell/schema';
import { isDay } from '../src/lib/meditation-bell/days';
import { localePreferenceKey } from '../src/i18n/routes';

test('Settings clears only bell data after confirmation and stops an open timer', async ({
  page,
  context,
}) => {
  const bell = await context.newPage();
  await bell.goto('/en/mini-apps/meditation-bell/');
  await expect(
    bell.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  await bell.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(bell.locator('body')).toHaveAttribute(
    'data-mini-app-busy',
    'true',
  );

  await page.goto('/en/settings/');
  await page.evaluate(
    ({ backupKey, localePreferenceKey }) => {
      localStorage.setItem(backupKey, 'unreadable bell data');
      localStorage.setItem(localePreferenceKey, 'en');
    },
    { backupKey, localePreferenceKey },
  );
  await page.reload();
  const saved = () =>
    page.evaluate(
      ({ storageKey, backupKey }) => [
        localStorage.getItem(storageKey),
        localStorage.getItem(backupKey),
      ],
      { storageKey, backupKey },
    );
  const original = await saved();
  expect(original[0]).not.toBeNull();
  expect(original[1]).toBe('unreadable bell data');

  await page.getByRole('button', { name: 'Reset my settings' }).click();
  expect(await saved()).toEqual(original);
  await page.evaluate(
    (key) => localStorage.setItem(key, 'en'),
    localePreferenceKey,
  );

  const clear = page.getByRole('button', {
    name: 'Clear bell data',
    exact: true,
  });
  const dialog = page.getByRole('dialog', {
    name: 'Clear Meditation Bell data?',
  });
  await clear.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await saved()).toEqual(original);

  await clear.click();
  await dialog.getByRole('button', { name: 'Clear bell data' }).click();
  await expect(page.getByText('Meditation Bell data cleared.')).toBeVisible();
  await expect(clear).toBeDisabled();
  expect(await saved()).toEqual([null, null]);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      localePreferenceKey,
    ),
  ).toBe('en');
  await expect(bell.locator('body')).toHaveAttribute(
    'data-mini-app-busy',
    'false',
  );
  await expect(bell.getByTestId('bell-status')).toHaveText('Ready');
  await bell.reload();
  await expect(
    bell.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  expect(await saved()).toEqual([null, null]);
});

test('Privacy explains browser storage and bell analytics in both locales', async ({
  page,
}) => {
  await page.goto('/en/privacy/');
  await expect(
    page.getByRole('region', { name: 'Meditation Bell data' }),
  ).toContainText(
    'your countdown or alarm, weekly schedule and bell sound choices on this device',
  );
  await expect(
    page.getByRole('region', { name: 'Meditation Bell data' }),
  ).toContainText('CSV schedule files are read in your browser');
  await expect(
    page.getByRole('region', { name: 'Website analytics' }),
  ).toContainText(
    'Analytics does not receive bell or alarm times, labels, file names or CSV contents.',
  );

  await page.goto('/my/privacy/');
  const stored = page.getByRole('region', {
    name: 'တရားထိုင်ခေါင်းလောင်း အချက်အလက်များ',
  });
  await expect(stored).toContainText('အပတ်စဉ် အချိန်ဇယား');
  await expect(stored).toContainText('ဘရောက်ဇာထဲမှာပင် ဖတ်ပါသည်');
  await expect(
    page.getByText('ခေါင်းလောင်းနှင့် နှိုးစက် မြည်မည့်အချိန်များ', {
      exact: false,
    }),
  ).toBeVisible();
});

test('an open bell page follows schedule changes from another tab', async ({
  page,
  context,
}) => {
  await page.goto('/en/mini-apps/meditation-bell/');
  await expect(
    page.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.getByRole('switch', { name: 'Weekly schedule' }).click();

  const other = await context.newPage();
  await other.goto('/en/mini-apps/meditation-bell/');
  await expect(
    other.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  await other.getByRole('button', { name: 'Schedule', exact: true }).click();
  const toggle = other.getByRole('switch', { name: 'Weekly schedule' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-mini-app-busy',
    'false',
  );
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Weekly schedule' }),
  ).not.toBeChecked();
});

test('the sound preview unlocks a restored schedule and sound edits retain checkpoints from another tab', async ({
  page,
  context,
}) => {
  await page.goto('/en/mini-apps/meditation-bell/');
  await expect(
    page.locator('[data-bell-timer][data-ready="true"]'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.getByRole('switch', { name: 'Weekly schedule' }).click();
  await page.reload();
  const enable = page.getByRole('button', { name: 'Enable sound' });
  await expect(enable).toBeVisible();
  await page.getByRole('button', { name: 'Bells', exact: true }).click();
  await page.getByRole('button', { name: 'Play: Start bell' }).click();
  await expect(enable).toHaveCount(0);

  const other = await context.newPage();
  await other.goto('/en/about/');
  await page.evaluate((key) => {
    window.addEventListener('storage', (event) => {
      if (event.key === key)
        document.documentElement.dataset.bellStorageReceived = 'true';
    });
  }, storageKey);
  const checkedAt = await other.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.schedule.checkedAt = Date.now() + 5000;
    localStorage.setItem(key, JSON.stringify(data));
    return data.schedule.checkedAt;
  }, storageKey);
  await expect(page.locator('html')).toHaveAttribute(
    'data-bell-storage-received',
    'true',
  );
  await page
    .getByRole('group', { name: 'Rings' })
    .getByRole('button', { name: '2x' })
    .click();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
  expect(saved.schedule.checkedAt).toBe(checkedAt);
  expect(saved.endBell.rings).toBe(2);
});

test('a backward clock correction does not silence the next weekly bell', async ({
  page,
}) => {
  const now = new Date('2026-11-25T19:00:00Z');
  await page.clock.install({ time: now });
  const bell = defaultState();
  bell.schedule = {
    on: true,
    checkedAt: now.getTime() + 86_400_000,
    week: bell.schedule.week,
  };
  const target = await page.evaluate((time) => {
    const date = new Date(time + 60_000);
    return {
      day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      time: [date.getHours(), date.getMinutes()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':'),
    };
  }, now.getTime());
  if (!isDay(target.day)) throw new Error('Invalid test weekday');
  bell.schedule.week[target.day].push({
    id: 'weekly',
    time: target.time,
    label: '',
    sound: 'winmetta-short',
    rings: 1,
  });
  await page.addInitScript(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        const root = document.documentElement;
        root.dataset.oscillators = String(
          Number(root.dataset.oscillators ?? '0') + 1,
        );
        return start.apply(this, args);
      };
    },
    { key: storageKey, data: bell },
  );
  await page.goto('/en/mini-apps/meditation-bell/');
  await page.getByRole('button', { name: 'Enable sound' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).schedule.checkedAt,
        storageKey,
      ),
    )
    .toBeLessThan(now.getTime() + 60_000);
  await page.clock.fastForward('01:03');
  await expect(page.locator('html')).toHaveAttribute('data-oscillators', '5');
});
