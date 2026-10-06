import { describe, expect, it } from 'vitest';
import { messages, validateMessages } from './messages';
import { localizedContent } from './content';
import { route, switchLocale, saveLocalePreference } from './routes';
describe('locale contracts', () => {
  it('requires complete non-empty keys for every registered locale', () => {
    expect(() => validateMessages()).not.toThrow();
    expect(() => validateMessages({ ...messages, my: {} })).toThrow(
      'translation keys',
    );
    expect(() =>
      validateMessages({ ...messages, my: { ...messages.my, brand: '' } }),
    ).toThrow();
  });
  it('preserves page, search and fragment while changing locale', () => {
    expect(route('my')).toBe('/my/');
    expect(
      switchLocale(
        new URL(
          'https://example.invalid/en/dhamma-library/?q=test&type=book#results',
        ),
        'my',
      ),
    ).toBe('/my/dhamma-library/?q=test&type=book#results');
    expect(switchLocale(new URL('https://example.invalid/'), 'my')).toBe(
      '/my/',
    );
  });
  it('does not require storage or a browser to persist an optional preference', () => {
    expect(() => saveLocalePreference('my')).not.toThrow();
  });
  it('makes fallback language explicit and rejects missing source content', () => {
    expect(localizedContent({ en: 'source' }, 'en', 'my')).toEqual({
      value: 'source',
      language: 'en',
      isFallback: true,
    });
    expect(
      localizedContent({ en: 'source', my: 'ဘာသာပြန်' }, 'en', 'my').isFallback,
    ).toBe(false);
    expect(() => localizedContent({}, 'en', 'my')).toThrow();
  });
});
