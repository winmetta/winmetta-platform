// Languages a Dhamma post is written in, in the fixed order they appear on the page and in the
// file. This is separate from the interface locale (en/my): readers pick any of these to read.
// To add a language, append it here, add its name message keys and update the existing posts.
import type { Locale } from '../../i18n/locales.ts';

export const postLanguages = ['my', 'en', 'zh-Hans'] as const;
export type PostLanguage = (typeof postLanguages)[number];

export const isPostLanguage = (value: string): value is PostLanguage =>
  (postLanguages as readonly string[]).includes(value);

/** Message keys for each language's name, shown in the interface locale. */
export const postLanguageNames = {
  my: 'langMy',
  en: 'langEn',
  'zh-Hans': 'langZh',
} as const satisfies Record<PostLanguage, string>;

/** The post language a reader sees before choosing: the interface language. */
export const defaultPostLanguage = (locale: Locale): PostLanguage => locale;

/** localStorage key for the reader's chosen post languages (a JSON array). */
export const postLanguagesStorageKey = 'winmetta.postLanguages';

// "Read in" in the address: ?lang=my,en,zh (fixed order; `zh` stands for zh-Hans, which is also
// accepted). Opening such a link applies those languages and remembers them.

const urlCodes = {
  my: 'my',
  en: 'en',
  'zh-Hans': 'zh',
} as const satisfies Record<PostLanguage, string>;

/** `en,zh` -> ['en', 'zh-Hans']; unknown codes are dropped, order is normalized. */
export function parseLangParam(value: string | null): PostLanguage[] {
  if (value === null) return [];
  const codes = value.split(',').map((code) => code.trim().toLowerCase());
  return postLanguages.filter(
    (lang) =>
      codes.includes(urlCodes[lang]) || codes.includes(lang.toLowerCase()),
  );
}

/** ['zh-Hans', 'my'] -> `my,zh`. */
export const formatLangParam = (langs: readonly PostLanguage[]): string =>
  postLanguages
    .filter((lang) => langs.includes(lang))
    .map((lang) => urlCodes[lang])
    .join(',');

/** The address with `lang` set (other query parameters and the fragment kept, comma unescaped). */
export function withLangParam(
  href: string,
  langs: readonly PostLanguage[],
): string {
  const url = new URL(href);
  url.searchParams.delete('lang');
  const rest = url.searchParams.toString();
  const lang = `lang=${formatLangParam(langs)}`;
  url.search = rest ? `${rest}&${lang}` : lang;
  return url.href;
}

/**
 * The post languages to show on page load: a valid ?lang= first (`fromUrl`, so the caller saves
 * it), then the stored choice, then the fallback. Self-contained, with no outside references:
 * Shell.astro inlines this function's source so it runs before the page paints. Keep its rules
 * in step with parseLangParam (languages.test.ts checks they agree).
 */
export function choosePostLanguages(
  search: string,
  stored: string | null,
  fallback: string,
): { langs: string[]; fromUrl: boolean } {
  const order = ['my', 'en', 'zh-Hans'];
  const aliases: Record<string, string> = {
    zh: 'zh-Hans',
    'zh-hans': 'zh-Hans',
  };
  const pick = (codes: string[]) =>
    order.filter((code) => codes.includes(code));
  const raw = new URLSearchParams(search).get('lang');
  const fromUrl =
    raw === null
      ? []
      : pick(
          raw.split(',').map((code) => {
            const key = code.trim().toLowerCase();
            return aliases[key] ?? key;
          }),
        );
  if (fromUrl.length > 0) return { langs: fromUrl, fromUrl: true };
  let saved: unknown;
  try {
    saved = JSON.parse(stored ?? '[]');
  } catch {
    saved = [];
  }
  const kept = Array.isArray(saved)
    ? pick(saved.filter((code): code is string => typeof code === 'string'))
    : [];
  return { langs: kept.length > 0 ? kept : [fallback], fromUrl: false };
}

/**
 * The inline <head> script (Shell.astro) that sets html[data-post-langs] before paint and saves
 * languages that came from ?lang=. Storage failures are ignored: the preference is optional.
 */
export const postLanguagesHeadScript = (
  fallback: PostLanguage,
): string => `(() => {
  const key = ${JSON.stringify(postLanguagesStorageKey)};
  let stored = null;
  try { stored = localStorage.getItem(key); } catch {}
  const chosen = (${choosePostLanguages.toString()})(location.search, stored, ${JSON.stringify(fallback)});
  if (chosen.fromUrl) {
    try { localStorage.setItem(key, JSON.stringify(chosen.langs)); } catch {}
  }
  document.documentElement.dataset.postLangs = chosen.langs.join(' ');
})();`;
