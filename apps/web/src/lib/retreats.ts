// Build-time view of the retreat archive.
import retreats from '../content/retreats.json';
import { localizedContent } from '../i18n/content';
import { locales, type Locale } from '../i18n/locales';
import { retreatRoute } from '../i18n/routes';
import { normalizeSearch } from './normalize';
import type { RetreatItem } from './retreat-filter';
import { retreatSchema, type Retreat } from './schemas';
import { teacherById, teacherName } from './teachers';

export const allRetreats: Retreat[] = retreatSchema
  .array()
  .parse(retreats)
  .sort((a, b) => b.startDate.localeCompare(a.startDate));

export const retreatText = (retreat: Retreat, locale: Locale) =>
  localizedContent(retreat.translations, retreat.sourceLanguage, locale);

const formatter = (locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locales[locale].formatLocale, {
    timeZone: 'UTC',
    numberingSystem: 'latn',
    ...options,
  });
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "25 Dec 2020 – 3 Jan 2021", in the interface language, Latin digits. */
export function retreatDates(retreat: Retreat, locale: Locale): string {
  const f = formatter(locale, { dateStyle: 'medium' });
  return f.formatRange(utc(retreat.startDate), utc(retreat.endDate));
}

export function retreatItem(retreat: Retreat, locale: Locale): RetreatItem {
  const teachers = retreat.teacherIds.flatMap((id) => {
    const teacher = teacherById(id);
    return teacher ? [{ id, name: teacherName(teacher, locale) }] : [];
  });
  const venue = retreat.venue
    ? `${retreat.venue.name[locale] ?? retreat.venue.name.en ?? ''}, ${retreat.venue.city}`
    : '';
  const everything = [
    ...Object.values(retreat.translations).flatMap((v) => [
      v.title,
      v.description,
    ]),
    ...retreat.teacherIds.flatMap((id) => {
      const teacher = teacherById(id);
      return teacher ? Object.values(teacher.names) : [];
    }),
    ...Object.values(retreat.venue?.name ?? {}),
    retreat.venue?.city ?? '',
    retreat.startDate.slice(0, 4),
    retreat.endDate.slice(0, 4),
    retreat.format,
  ];
  return {
    id: retreat.id,
    href: retreatRoute(locale, retreat.id),
    title: retreatText(retreat, locale).value.title,
    dates: retreatDates(retreat, locale),
    year: Number(retreat.startDate.slice(0, 4)),
    format: retreat.format,
    days: retreat.days,
    teachers,
    venue,
    haystack: normalizeSearch(everything.join(' ')),
  };
}

export const retreatsOf = (teacherId: string): Retreat[] =>
  allRetreats.filter((retreat) => retreat.teacherIds.includes(teacherId));
