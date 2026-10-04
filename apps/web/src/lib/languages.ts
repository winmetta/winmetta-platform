// "Burmese", "English" or "Burmese and English" in the interface language.
import type { Locale } from '../i18n/locales';
import { format, t } from '../i18n/messages';

const names = { my: 'langMy', en: 'langEn' } as const;

export function languageList(codes: string[], locale: Locale): string {
  const labels = codes.map((code) =>
    code in names ? t(locale, names[code as keyof typeof names]) : code,
  );
  const [first = '', second] = labels;
  return labels.length > 1 && second !== undefined
    ? format(t(locale, 'langAnd'), { a: first, b: second })
    : first;
}
