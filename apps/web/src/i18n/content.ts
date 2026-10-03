import type { Locale } from './locales';
export function localizedContent<T>(
  translations: Record<string, T>,
  sourceLanguage: string,
  requested: Locale,
): { value: T; language: string; isFallback: boolean } {
  const translated = translations[requested];
  if (translated !== undefined)
    return { value: translated, language: requested, isFallback: false };
  const source = translations[sourceLanguage];
  if (source === undefined)
    throw new Error(`Missing source translation: ${sourceLanguage}`);
  return { value: source, language: sourceLanguage, isFallback: true };
}
