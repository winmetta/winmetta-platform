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
/** Fills `{name}` placeholders. Throws if a value is missing, so a typo is caught at build time. */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Missing value for {${name}}`);
    return String(value);
  });
}
const placeholdersOf = (template: string): string =>
  [...template.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
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
    // Every locale must use the same {placeholders} as English for the same key.
    for (const [key, value] of Object.entries(catalog)) {
      const source = (en as Record<string, string>)[key] ?? '';
      if (placeholdersOf(value) !== placeholdersOf(source))
        throw new Error(`Placeholders differ for "${key}" in ${locale}`);
    }
  }
}
