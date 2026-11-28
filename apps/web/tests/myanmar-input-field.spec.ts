import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';

// The shared Burmese field (docs/myanmar-input.md §4), on a page the spec builds itself with Vite:
// no site page uses it yet. Analytics is stubbed to record every event the field sends.
let bundle = '';
let styles = '';
test.beforeAll(async () => {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    oxc: { jsx: { runtime: 'automatic' } },
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry: fileURLToPath(
          new URL('./fixtures/input-field-entry.tsx', import.meta.url),
        ),
        formats: ['iife'],
        name: 'InputFieldTest',
      },
    },
  });
  const outputs = Array.isArray(output) ? output : [output];
  const first = outputs[0];
  if (!first || !('output' in first)) throw new Error('bundle failed');
  bundle = first.output.find((chunk) => chunk.type === 'chunk')?.code ?? '';
  styles = first.output
    .flatMap((chunk) =>
      chunk.type === 'asset' && chunk.fileName.endsWith('.css')
        ? [String(chunk.source)]
        : [],
    )
    .join('\n');
});

async function open(page: Page, saved?: object) {
  await page.addInitScript((value) => {
    const w = window as unknown as Record<string, unknown>;
    w.sent = [];
    w.umami = {
      track: (name: string, data: unknown) =>
        (w.sent as unknown[]).push({ name, data }),
    };
    if (value) localStorage.setItem('winmetta.input', JSON.stringify(value));
  }, saved);
  // A real origin, so localStorage works (a blank page has none).
  await page.route('http://app.test/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><main id="root"></main>',
    }),
  );
  await page.goto('http://app.test/');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('#field')).toBeVisible();
}

const sent = (page: Page) =>
  page.evaluate(() => (window as unknown as { sent: unknown[] }).sent);
const last = (page: Page) =>
  page.evaluate(() => {
    const changes = (window as unknown as { changes: { unicode: string }[] })
      .changes;
    return changes[changes.length - 1]?.unicode;
  });

test('Auto converts Zawgyi and says so', async ({ page }) => {
  await open(page);
  await page.locator('#field').fill('ျမန္မာ');
  await expect.poll(() => last(page)).toBe('မြန်မာ');
  await expect(
    page.getByText('Converted from Zawgyi to Unicode.'),
  ).toBeVisible();
  await expect(page.locator('#field')).toHaveClass(/font-zawgyi/);
  await expect(page.locator('[data-using]')).toContainText('မြန်မာ');
});

test('Auto leaves Pāḷi stacks alone and is not sure', async ({ page }) => {
  await open(page);
  await page.locator('#field').fill('ဓမ္မ');
  await expect.poll(() => last(page)).toBe('ဓမ္မ');
  await expect(
    page.getByText(/Not sure if this is Unicode or Zawgyi/),
  ).toBeVisible();
});

test('Win Innwa: Shift+F stacks, and the app gets Unicode', async ({
  page,
}) => {
  await open(page, { method: 'win-innwa', stackKey: true });
  await expect(page.locator('#field')).toHaveClass(/font-win-innwa/);
  await page.locator('#field').focus();
  await page.keyboard.type('"r');
  await page.keyboard.press('Shift+F');
  await page.keyboard.press('r');
  await expect(page.locator('#field')).toHaveValue('"r®');
  await expect.poll(() => last(page)).toBe('ဓမ္မ');
  await expect(page.locator('[data-using]')).toContainText('ဓမ္မ');
});

test('the picker changes the setting and converts what is in the box', async ({
  page,
}) => {
  await open(page, { method: 'unicode', stackKey: true });
  await page.locator('#field').fill('ဓမ္မ');
  await page.getByRole('button', { name: 'Win Innwa' }).click();
  await expect(page.locator('#field')).toHaveValue('"r®');
  expect(
    await page.evaluate(() => localStorage.getItem('winmetta.input')),
  ).toBe('{"method":"win-innwa","stackKey":true}');
  await page.getByRole('button', { name: 'As typed' }).click();
  await expect(page.locator('#field')).toHaveValue('ဓမ္မ');
});

test('the Pāḷi keys tray types into the box and keeps the caret there', async ({
  page,
}) => {
  await open(page);
  await page.locator('#field').fill('ဓ');
  await page.getByText('Pāḷi keys').click();
  await page.getByRole('button', { name: '◌္မ' }).click();
  await expect(page.locator('#field')).toHaveValue('ဓ္မ');
  await expect(page.locator('#field')).toBeFocused();
  await expect.poll(() => last(page)).toBe('ဓ္မ');
});

test('only fixed labels reach the tracker, never the text', async ({
  page,
}) => {
  await open(page, { method: 'win-innwa', stackKey: true });
  await page.locator('#field').focus();
  await page.keyboard.type('"r');
  await page.getByText('Pāḷi keys').click();
  await page.getByRole('button', { name: '◌္က' }).click();
  await page.getByRole('button', { name: 'Auto' }).click();
  const events = (await sent(page)) as {
    name: string;
    data: Record<string, unknown>;
  }[];
  expect(events.map((e) => e.name)).toEqual([
    'input_keys_use',
    'input_method_change',
  ]);
  expect(events[0]?.data).toEqual({ app: 'test-app', kind: 'stack' });
  expect(events[1]?.data).toEqual({ method: 'auto', via: 'field' });
  const everything = JSON.stringify(events);
  for (const text of ['"r', 'ဓ', 'မ', 'က'])
    expect(everything).not.toContain(text);
});
