import { expect, test } from '@playwright/test';
import { backupKey, storageKey } from '../src/lib/meditation-bell/schema';
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
