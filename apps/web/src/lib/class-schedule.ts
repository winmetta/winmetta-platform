// Weekly class slots shown in Pacific and Myanmar time. Built on occurrenceOn, so the Pacific
// wall time is the source of truth and the Myanmar time follows US daylight saving.
import { DateTime } from 'luxon';
import { locales, type Locale } from '../i18n/locales';
import { occurrenceOn, scheduleZones } from './schedule';
import type { ClassSlot } from './schemas';

const toMinutes = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
/** Length of a slot in minutes (slots do not cross midnight). */
export const durationMinutes = (slot: ClassSlot): number =>
  toMinutes(slot.endTime) - toMinutes(slot.time);

export interface NextOccurrence {
  start: Date;
  end: Date;
  /** The class is running right now. */
  inProgress: boolean;
}

/** The current or next occurrence of a weekly slot at the given moment. */
export function nextOccurrence(slot: ClassSlot, now: Date): NextOccurrence {
  const today = DateTime.fromJSDate(now, { zone: slot.timezone }).startOf(
    'day',
  );
  for (let offset = 0; offset <= 8; offset++) {
    const day = today.plus({ days: offset });
    if (day.weekday !== slot.weekday) continue;
    const date = day.toISODate();
    if (!date) continue;
    let start: Date;
    try {
      start = occurrenceOn(slot, date);
    } catch {
      continue; // the wall time does not exist that day (US spring forward)
    }
    const end = new Date(start.getTime() + durationMinutes(slot) * 60_000);
    if (end.getTime() > now.getTime())
      return { start, end, inProgress: start.getTime() <= now.getTime() };
  }
  throw new Error('No occurrence within eight days');
}

export interface ZoneView {
  zone: string;
  weekday: string;
  date: string;
  start: string;
  end: string;
}
export interface SlotView {
  pacific: ZoneView;
  myanmar: ZoneView;
  /** Myanmar is on a different weekday than Pacific. */
  rollsOver: boolean;
}

const formatter = (
  locale: Locale,
  zone: string,
  options: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat(locales[locale].formatLocale, {
    timeZone: zone,
    numberingSystem: 'latn',
    ...options,
  });

export function zoneView(
  next: NextOccurrence,
  locale: Locale,
  zone: string,
): ZoneView {
  const time: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  return {
    zone,
    weekday: formatter(locale, zone, { weekday: 'long' }).format(next.start),
    date: formatter(locale, zone, { dateStyle: 'medium' }).format(next.start),
    start: formatter(locale, zone, time).format(next.start),
    end: formatter(locale, zone, time).format(next.end),
  };
}

/** One occurrence as Pacific and Myanmar times, with the day rollover made explicit. */
export function slotView(next: NextOccurrence, locale: Locale): SlotView {
  const [pacificZone, myanmarZone] = scheduleZones;
  const pacific = zoneView(next, locale, pacificZone);
  const myanmar = zoneView(next, locale, myanmarZone);
  const dayOf = (zone: string) =>
    formatter('en', zone, { weekday: 'short' }).format(next.start);
  return {
    pacific,
    myanmar,
    rollsOver: dayOf(pacificZone) !== dayOf(myanmarZone),
  };
}

/** Localized weekday name for an ISO weekday (1 = Monday). */
export function weekdayName(weekday: number, locale: Locale): string {
  // 2024-01-01 was a Monday.
  const date = new Date(Date.UTC(2024, 0, weekday));
  return formatter(locale, 'UTC', { weekday: 'long' }).format(date);
}

/** The recurring slot's own wall times in its zone, e.g. "6:30 PM – 7:30 PM". */
export function slotTimes(slot: ClassSlot, locale: Locale): string {
  const base = DateTime.fromISO('2026-01-05T00:00', { zone: 'UTC' }); // any date: only wall time matters
  const show = (time: string) =>
    formatter(locale, 'UTC', { hour: 'numeric', minute: '2-digit' }).format(
      base.plus({ minutes: toMinutes(time) }).toJSDate(),
    );
  return `${show(slot.time)} – ${show(slot.endTime)}`;
}
