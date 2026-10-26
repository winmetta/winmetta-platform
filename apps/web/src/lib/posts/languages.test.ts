import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/messages/en.json';
import my from '../../i18n/messages/my.json';
import {
  choosePostLanguages,
  postLanguageNames,
  formatLangParam,
  parseLangParam,
  postLanguages,
  postLanguagesHeadScript,
  postLanguagesStorageKey,
  withLangParam,
} from './languages';

const cases: [string | null, string[]][] = [
  ['en,zh', ['en', 'zh-Hans']],
  ['zh,my', ['my', 'zh-Hans']],
  ['zh-Hans', ['zh-Hans']],
  ['ZH-HANS, EN', ['en', 'zh-Hans']],
  ['en,en', ['en']],
  ['fr,xx', []],
  ['', []],
  [null, []],
];

describe('lang URL parameter', () => {
  it.each(cases)('parses %j', (value, langs) => {
    expect(parseLangParam(value)).toEqual(langs);
  });
  it('formats in the fixed order with short codes', () => {
    expect(formatLangParam(['zh-Hans', 'my'])).toBe('my,zh');
    expect(formatLangParam(['en'])).toBe('en');
  });
  it('sets lang, keeping other parameters and the fragment', () => {
    expect(
      withLangParam('https://app.example.invalid/en/x/?a=1&lang=my#part', [
        'en',
        'zh-Hans',
      ]),
    ).toBe('https://app.example.invalid/en/x/?a=1&lang=en,zh#part');
    expect(withLangParam('https://app.example.invalid/my/', ['my'])).toBe(
      'https://app.example.invalid/my/?lang=my',
    );
  });
});

describe('choosePostLanguages (inlined before paint)', () => {
  it('follows the same order as postLanguages', () => {
    expect(choosePostLanguages('?lang=zh,en,my', null, 'en').langs).toEqual([
      ...postLanguages,
    ]);
  });
  it.each(cases)('agrees with parseLangParam for %j', (value, langs) => {
    const search = value === null ? '' : `?lang=${encodeURIComponent(value)}`;
    const chosen = choosePostLanguages(search, null, 'my');
    expect(chosen.fromUrl).toBe(langs.length > 0);
    expect(chosen.langs).toEqual(langs.length > 0 ? langs : ['my']);
  });
  it('uses the stored choice, then the fallback', () => {
    expect(choosePostLanguages('', '["zh-Hans","en"]', 'my')).toEqual({
      langs: ['en', 'zh-Hans'],
      fromUrl: false,
    });
    expect(choosePostLanguages('', 'not json', 'my').langs).toEqual(['my']);
    expect(choosePostLanguages('?lang=xx', '[]', 'en').langs).toEqual(['en']);
  });
  it('the head script applies ?lang= and saves it', () => {
    const store = new Map<string, string>();
    const root = { dataset: {} as Record<string, string> };
    const run = (search: string) =>
      new Function(
        'localStorage',
        'location',
        'document',
        postLanguagesHeadScript('my'),
      )(
        {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
        },
        { search },
        { documentElement: root },
      );
    run('?lang=zh,en');
    expect(root.dataset.postLangs).toBe('en zh-Hans');
    expect(store.get(postLanguagesStorageKey)).toBe('["en","zh-Hans"]');
    run('');
    expect(root.dataset.postLangs).toBe('en zh-Hans');
  });
});

// Adding a post language touches several lists (AGENTS.md §7); these fail when one is missed.
describe('every post language is wired up', () => {
  const css = readFileSync(
    new URL('../../styles/global.css', import.meta.url),
    'utf8',
  );
  it.each([...postLanguages])('%s', (lang) => {
    const code = formatLangParam([lang]);
    // The inlined head script knows the language by its URL code and its full code.
    for (const value of [code, lang])
      expect(choosePostLanguages(`?lang=${value}`, null, 'en').langs).toEqual([
        lang,
      ]);
    expect(choosePostLanguages('', JSON.stringify([lang]), 'en').langs).toEqual(
      [lang],
    );
    expect(parseLangParam(code)).toEqual([lang]);
    expect(en[postLanguageNames[lang]]).toBeTruthy();
    expect(my[postLanguageNames[lang]]).toBeTruthy();
    expect(css).toContain(
      `html.js:not([data-post-langs~='${lang}']) [data-post-lang='${lang}']`,
    );
  });
});
