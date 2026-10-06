// Build-time view of the teachers: validated records plus locale-aware names and biographies.
import teachers from '../content/teachers.json';
import { localizedContent } from '../i18n/content';
import type { Locale } from '../i18n/locales';
import { teacherSchema, type Teacher } from './schemas';

export const allTeachers: Teacher[] = teacherSchema.array().parse(teachers);
const byId = new Map(allTeachers.map((teacher) => [teacher.id, teacher]));

export const teacherById = (id: string): Teacher | undefined => byId.get(id);

/** Name in the requested locale, else in the teacher's source language. */
export const teacherName = (teacher: Teacher, locale: Locale): string =>
  teacher.names[locale] ?? teacher.names[teacher.sourceLanguage] ?? teacher.id;

export const teacherPlace = (
  teacher: Teacher,
  locale: Locale,
): string | undefined =>
  teacher.place?.[locale] ?? teacher.place?.[teacher.sourceLanguage];

/**
 * The biography for a locale. A language the teacher has no text in falls back to the source
 * language and says so (never presented as a translation); an unreviewed translation is a draft.
 */
export function teacherBio(teacher: Teacher, locale: Locale) {
  const { value, language, isFallback } = localizedContent(
    teacher.bio,
    teacher.sourceLanguage,
    locale,
  );
  return {
    sections: value.sections,
    language,
    isFallback,
    isDraft: !isFallback && !value.reviewed,
  };
}
