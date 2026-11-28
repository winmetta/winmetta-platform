import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';

// The adapter is bundled once with Vite (the bundler the site uses) and loaded into a blank page.
let bundle = '';
test.beforeAll(async () => {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL('../src/dom.ts', import.meta.url)),
        formats: ['iife'],
        name: 'MyanmarInputDom',
      },
    },
  });
  const outputs = Array.isArray(output) ? output : [output];
  const first = outputs[0];
  if (!first || !('output' in first)) throw new Error('bundle failed');
  const chunk = first.output[0];
  bundle = chunk.code;
});

interface Handle {
  update(options: object): void;
  detach(): void;
}
interface Win {
  inputEvents: number;
  handle: Handle;
  MyanmarInputDom: { attachInput(field: unknown, options: object): Handle };
}

async function open(page: Page, method: string, extra = ''): Promise<void> {
  await page.setContent('<input id="f"><textarea id="t"></textarea>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    ([m, more]) => {
      const w = window as unknown as Win;
      const field = document.getElementById('f') as HTMLInputElement;
      w.inputEvents = 0;
      field.addEventListener('input', () => {
        w.inputEvents += 1;
      });
      w.handle = w.MyanmarInputDom.attachInput(field, {
        method: m,
        ...JSON.parse(more || '{}'),
      });
    },
    [method, extra],
  );
  await page.locator('#f').focus();
}

const value = (page: Page) => page.locator('#f').inputValue();

test.describe('Win Innwa dead key', () => {
  test('Shift+F then a consonant key types the stacked glyph', async ({
    page,
  }) => {
    await open(page, 'win-innwa');
    await page.keyboard.press('r');
    await page.keyboard.press('Shift+F');
    expect(await value(page)).toBe('r'); // the dead key types nothing
    await page.keyboard.press('r');
    expect(await value(page)).toBe('r®');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('Shift+Q');
    expect(await value(page)).toBe('r®Ñ');
  });

  test('tells the page with input events', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('u');
    expect(
      await page.evaluate(() => (window as unknown as Win).inputEvents),
    ).toBe(1);
  });

  test('a ligature replaces the glyph before the caret', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.keyboard.type('#');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('#');
    expect(await value(page)).toBe('¥');
  });

  test('ff makes kinzi from asat', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.keyboard.type('iff');
    expect(await value(page)).toBe('iF');
  });

  test('a key not in the table cancels and types normally', async ({
    page,
  }) => {
    await open(page, 'win-innwa');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('1');
    expect(await value(page)).toBe('1');
    await page.keyboard.press('r');
    expect(await value(page)).toBe('1r');
  });

  test('replaces a selection', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.keyboard.type('abc');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('r');
    expect(await value(page)).toBe('ab®');
  });

  test('a mouse click drops a pending dead key', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.keyboard.press('Shift+F');
    await page.locator('#f').click();
    await page.keyboard.press('r');
    expect(await value(page)).toBe('r');
  });

  test('works in a textarea', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.MyanmarInputDom.attachInput(document.getElementById('t'), {
        method: 'win-innwa',
      });
    });
    await page.locator('#t').focus();
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('r');
    expect(await page.locator('#t').inputValue()).toBe('®');
  });
});

test.describe('other methods, settings and detach', () => {
  for (const method of ['auto', 'unicode']) {
    test(`${method} types Shift+F as F`, async ({ page }) => {
      await open(page, method);
      await page.keyboard.press('Shift+F');
      await page.keyboard.press('r');
      expect(await value(page)).toBe('Fr');
    });
  }

  test('stacking can be switched off, and the method changed later', async ({
    page,
  }) => {
    await open(page, 'win-innwa', '{"stackKey":false}');
    await page.keyboard.press('Shift+F');
    expect(await value(page)).toBe('F');
    await page.evaluate(() =>
      (window as unknown as Win).handle.update({ stackKey: true }),
    );
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('r');
    expect(await value(page)).toBe('F®');
    await page.evaluate(() =>
      (window as unknown as Win).handle.update({ method: 'auto' }),
    );
    await page.keyboard.press('Shift+F');
    expect(await value(page)).toBe('F®F');
  });

  test('detach stops everything', async ({ page }) => {
    await open(page, 'win-innwa');
    await page.evaluate(() => (window as unknown as Win).handle.detach());
    await page.keyboard.press('Shift+F');
    expect(await value(page)).toBe('F');
  });
});

test.describe('paste', () => {
  const paste = (page: Page, text: string) =>
    page.evaluate((data) => {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', data);
      const event = new ClipboardEvent('paste', {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      });
      document.getElementById('f')!.dispatchEvent(event);
      return event.defaultPrevented;
    }, text);

  test('keeps pasted Latin-1 glyph codes as they are', async ({ page }) => {
    await open(page, 'win-innwa');
    expect(await paste(page, '"r®')).toBe(false); // the browser inserts it
  });

  test('turns pasted Unicode Burmese into glyph codes', async ({ page }) => {
    await open(page, 'win-innwa');
    expect(await paste(page, 'ဓမ္မ')).toBe(true);
    expect(await value(page)).toBe('"r®');
  });

  test('leaves paste alone in Auto and As typed', async ({ page }) => {
    await open(page, 'auto');
    expect(await paste(page, 'ဓမ္မ')).toBe(false);
  });
});

test.describe('composition', () => {
  test('is never rewritten, and keys during it are not read', async ({
    page,
  }) => {
    await open(page, 'win-innwa');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', {
      text: 'ဓ',
      selectionStart: 1,
      selectionEnd: 1,
    });
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'F',
        shiftKey: true,
        isComposing: true,
        bubbles: true,
        cancelable: true,
      });
      document.getElementById('f')!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await cdp.send('Input.insertText', { text: 'ဓ' });
    expect(await value(page)).toBe('ဓ');
    // The dead key was not armed by the composing key press.
    await page.keyboard.press('r');
    expect(await value(page)).toBe('ဓr');
  });
});
