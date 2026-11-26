import { describe, expect, it } from 'vitest';
import { messages, validateMessages } from './messages';
import { localizedContent } from './content';
import { inlineLinks } from './inline-links';
import {
  route,
  switchLocale,
  saveLocalePreference,
  clearLocalePreference,
  readLocalePreference,
  rootRedirectScript,
} from './routes';
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
  it('reads and clears the saved language without storage', () => {
    expect(readLocalePreference()).toBeUndefined();
    expect(clearLocalePreference()).toBe(false);
  });
  it('builds a root script that only redirects to a known language', () => {
    const run = (saved: string | null) => {
      let to = '';
      new Function(
        'localStorage',
        'location',
        rootRedirectScript(['en', 'my']),
      )(
        { getItem: () => saved },
        {
          search: '?a=1',
          hash: '#x',
          replace: (url: string) => (to = url),
        },
      );
      return to;
    };
    expect(run('en')).toBe('/en/?a=1#x');
    expect(run('my')).toBe('/my/?a=1#x');
    expect(run('zz')).toBe('');
    expect(run(null)).toBe('');
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

describe('inline links in messages', () => {
  it('turns page ids and https URLs into links and keeps the text around them', () => {
    expect(
      inlineLinks('my', 'See [classes](classes) and [Zoom](https://zoom.us/).'),
    ).toEqual([
      'See ',
      { label: 'classes', href: '/my/classes/', external: false },
      ' and ',
      { label: 'Zoom', href: 'https://zoom.us/', external: true },
      '.',
    ]);
    expect(inlineLinks('en', 'No links here.')).toEqual(['No links here.']);
  });
  it('fails on an unknown target, so a typo breaks the build', () => {
    expect(() => inlineLinks('en', '[x](clases)')).toThrow('clases');
    expect(() => inlineLinks('en', '[x](http://zoom.us/)')).toThrow();
  });
  it('requires every locale to link to the same places', () => {
    expect(() =>
      validateMessages({
        ...messages,
        my: { ...messages.my, donateSupportClasses: 'ဓမ္မ' },
      }),
    ).toThrow('Link targets differ');
  });
});
