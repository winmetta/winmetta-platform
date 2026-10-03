export const locales = {
  en: { name: 'English', direction: 'ltr', formatLocale: 'en-US' },
  my: { name: 'မြန်မာ', direction: 'ltr', formatLocale: 'my-MM' },
} as const;
export type Locale = keyof typeof locales;
export const localeCodes = Object.keys(locales) as Locale[];
export function isLocale(value: string): value is Locale {
  return Object.hasOwn(locales, value);
}
