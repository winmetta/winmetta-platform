import { expect, test } from '@playwright/test';

// The site-wide Burmese typing setting (docs/myanmar-input.md §6). The rows show only when mini apps
// are on, like the bell data row.
const enabled = process.env.PUBLIC_MINI_APPS === 'true';
test.skip(!enabled, 'The typing rows are hidden without PUBLIC_MINI_APPS.');

const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('winmetta.input'));

test('the rows follow the choice, save it and are covered by Reset', async ({
  page,
}) => {
  await page.goto('/en/settings/');
  const method = page.getByRole('group', { name: 'Burmese typing' });
  const stack = page.getByRole('group', { name: 'Stack with Shift+F' });
  await expect(method.getByRole('button', { name: 'Auto' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Stacking is only for Win Innwa: disabled, with a note, until then.
  await expect(stack.getByRole('button', { name: 'Off' })).toBeDisabled();
  await expect(
    page.getByText('Available when Win Innwa is chosen.'),
  ).toBeVisible();
  expect(await saved(page)).toBeNull();

  await method.getByRole('button', { name: 'Win Innwa' }).click();
  expect(await saved(page)).toBe('{"method":"win-innwa","stackKey":true}');
  await expect(stack.getByRole('button', { name: 'Off' })).toBeEnabled();
  await expect(
    page.getByText('Available when Win Innwa is chosen.'),
  ).toBeHidden();
  await expect(page.getByText('Saved.').first()).toBeVisible();

  await stack.getByRole('button', { name: 'Off' }).click();
  expect(await saved(page)).toBe('{"method":"win-innwa","stackKey":false}');

  // The saved value survives a reload, and a method change keeps the switch's value.
  await page.reload();
  await expect(
    method.getByRole('button', { name: 'Win Innwa' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await method.getByRole('button', { name: 'As typed' }).click();
  await expect(stack.getByRole('button', { name: 'Off' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(stack.getByRole('button', { name: 'Off' })).toBeDisabled();

  await page.getByRole('button', { name: 'Reset' }).click();
  expect(await saved(page)).toBeNull();
  await expect(method.getByRole('button', { name: 'Auto' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled();
});

test('the rows have Burmese titles', async ({ page }) => {
  await page.goto('/my/settings/');
  await expect(
    page.getByRole('heading', { name: 'မြန်မာစာ ရိုက်နည်း' }),
  ).toBeVisible();
});
