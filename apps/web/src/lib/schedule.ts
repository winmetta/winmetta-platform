import { DateTime } from 'luxon';
import { locales, type Locale } from '../i18n/locales';
import { recurrenceSchema, type Recurrence } from './schemas';
export const scheduleZones = ['America/Los_Angeles', 'Asia/Yangon'] as const;
/** Returns the occurrence on an exact source-zone date, not a browser-local date.
 * Missing spring-forward times are rejected. Ambiguous fall-back times use the
 * earlier instant, so results do not depend on the machine's current offset.
 */
export function occurrenceOn(schedule: Recurrence, sourceDate: string): Date {
  recurrenceSchema.parse(schedule);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate))
    throw new Error('Use YYYY-MM-DD');
  const day = DateTime.fromISO(sourceDate, { zone: schedule.timezone });
  if (!day.isValid || day.weekday !== schedule.weekday)
    throw new Error('Date does not match recurrence');
  const local = DateTime.fromISO(`${sourceDate}T${schedule.time}`, {
    zone: schedule.timezone,
  });
  if (!local.isValid || local.toFormat('HH:mm') !== schedule.time)
    throw new Error('Local time does not exist on this date');
  const instants = local.getPossibleOffsets().map((item) => item.toMillis());
  return new Date(Math.min(...instants));
}
export function formatOccurrence(
  instant: Date,
  locale: Locale,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locales[locale].formatLocale, {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);
}
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locales[locale].formatLocale).format(value);
}
