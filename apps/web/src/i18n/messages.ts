import en from './messages/en.json';
import my from './messages/my.json';
import { localeCodes, type Locale } from './locales';
export const messages = { en, my } satisfies Record<
  Locale,
  Record<keyof typeof en, string>
>;
export type MessageKey = keyof typeof en;
export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}
export function validateMessages(
  catalogs: Record<string, Record<string, string>> = messages,
): void {
  const expected = Object.keys(en).sort();
  for (const locale of localeCodes) {
    const catalog = catalogs[locale];
    if (
      !catalog ||
      JSON.stringify(Object.keys(catalog).sort()) !==
        JSON.stringify(expected) ||
      Object.values(catalog).some((value) => !value.trim())
    ) {
      throw new Error(
        `Missing, empty or unexpected translation keys for ${locale}`,
      );
    }
  }
}
