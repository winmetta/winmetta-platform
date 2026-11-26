// The weekly schedule (docs/meditation-bell.md §4). Bell times are local wall-clock times, so 6:00
// AM stays 6:00 AM across daylight-saving changes. Pure: functions take the current time.
import type { DateTime } from 'luxon';
import { atClock, parseClock } from './alarm';
import { dayOfWeekday, days, type Day } from './days';
import { lateGraceMs } from './timer';

export const maxLabelLength = 40;
export const minRings = 1;
export const maxRings = 6;

export interface Bell {
  id: string;
  /** 24-hour `HH:MM`. */
  time: string;
  label: string;
  sound: string;
  rings: number;
}

/** Bells per day, each list sorted by time. */
export type Week = Record<Day, Bell[]>;

export const emptyWeek = (): Week => ({
  Mon: [],
  Tue: [],
  Wed: [],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: [],
});

export const bellCount = (week: Week): number =>
  days.reduce((sum, day) => sum + week[day].length, 0);

export type BellError =
  | { kind: 'no-time' }
  | { kind: 'no-day' }
  | { kind: 'invalid-time' }
  | { kind: 'invalid-rings' }
  | { kind: 'label-too-long' }
  /** "A bell at 6:00 AM is already set on Tuesday" */
  | { kind: 'duplicate'; day: Day; time: string };

const byTime = (a: Bell, b: Bell): number => a.time.localeCompare(b.time);

export function validateBell(
  bell: Omit<Bell, 'id'>,
  selectedDays: readonly Day[],
): BellError | undefined {
  if (!bell.time) return { kind: 'no-time' };
  if (!parseClock(bell.time)) return { kind: 'invalid-time' };
  if (selectedDays.length === 0) return { kind: 'no-day' };
  if (
    !Number.isInteger(bell.rings) ||
    bell.rings < minRings ||
    bell.rings > maxRings
  )
    return { kind: 'invalid-rings' };
  if (bell.label.length > maxLabelLength) return { kind: 'label-too-long' };
  return undefined;
}

/**
 * Add a bell on every chosen day. `ignoreId` skips that bell when checking for a bell already set
 * at the same time (used when editing). Returns the new week, or the first error; nothing changes
 * on an error.
 */
export function addBell(
  week: Week,
  bell: Bell,
  selectedDays: readonly Day[],
  ignoreId?: string,
): { week: Week } | { error: BellError } {
  const error = validateBell(bell, selectedDays);
  if (error) return { error };
  for (const day of days) {
    if (!selectedDays.includes(day)) continue;
    const clash = week[day].find(
      (b) => b.time === bell.time && b.id !== ignoreId,
    );
    if (clash) return { error: { kind: 'duplicate', day, time: bell.time } };
  }
  const next = { ...week };
  for (const day of days) {
    if (selectedDays.includes(day))
      next[day] = [...week[day].filter((b) => b.id !== bell.id), bell].sort(
        byTime,
      );
  }
  return { week: next };
}

/** Delete a bell from every day it is on. */
export function deleteBell(week: Week, id: string): Week {
  const next = { ...week };
  for (const day of days) next[day] = week[day].filter((b) => b.id !== id);
  return next;
}

const alike = (a: Bell, b: Bell): boolean =>
  a.time === b.time &&
  a.label === b.label &&
  a.sound === b.sound &&
  a.rings === b.rings;

/** Every day with a bell like this one (same time, label, sound and rings), so a CSV import of
 * the same bell on several days reads as one bell. */
export const daysLikeBell = (week: Week, bell: Bell): Day[] =>
  days.filter((day) => week[day].some((b) => alike(b, bell)));

/** Give every bell like `bell` its id, so editing or deleting it acts on all of its days. */
export function unifyLikeBells(week: Week, bell: Bell): Week {
  const next = { ...week };
  for (const day of days)
    next[day] = week[day].map((b) =>
      alike(b, bell) ? { ...b, id: bell.id } : b,
    );
  return next;
}

/**
 * Edit a bell, possibly moving it to other days: it is removed from every day, then saved on the
 * chosen ones. On an error nothing changes.
 */
export function editBell(
  week: Week,
  bell: Bell,
  selectedDays: readonly Day[],
): { week: Week } | { error: BellError } {
  return addBell(deleteBell(week, bell.id), bell, selectedDays, bell.id);
}

export interface Occurrence {
  bell: Bell;
  day: Day;
  /** Epoch milliseconds. */
  at: number;
}

/**
 * Every scheduled ring in (from, to], oldest first. A time skipped by a daylight-saving change
 * rings at the next valid minute; a time that occurs twice rings once (the first).
 */
export function occurrencesBetween(
  week: Week,
  from: DateTime,
  to: DateTime,
): Occurrence[] {
  const found: Occurrence[] = [];
  const last = to.startOf('day');
  for (
    let day = from.startOf('day');
    day <= last;
    day = day.plus({ days: 1 })
  ) {
    const name = dayOfWeekday(day.weekday);
    for (const bell of week[name]) {
      const clock = parseClock(bell.time);
      if (!clock) continue;
      const at = atClock(day, clock).toMillis();
      if (at > from.toMillis() && at <= to.toMillis())
        found.push({ bell, day: name, at });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

/** The next bell strictly after `now`, looking up to eight days ahead; undefined when none. */
export function nextBell(week: Week, now: DateTime): Occurrence | undefined {
  return occurrencesBetween(week, now, now.plus({ days: 8 }))[0];
}

export interface DueBells {
  /** Rings now: due within the two-minute grace, newest-last. */
  ring: Occurrence[];
  /** Too old: shown as a notice, not rung. */
  missed: Occurrence[];
}

/**
 * Bells that fell due between `lastChecked` and `now` (the page was in the background, asleep or
 * closed). Those two minutes late or less ring; older ones are reported as missed.
 */
export function dueBells(
  week: Week,
  lastChecked: DateTime,
  now: DateTime,
): DueBells {
  const due = occurrencesBetween(week, lastChecked, now);
  return {
    ring: due.filter((o) => now.toMillis() - o.at <= lateGraceMs),
    missed: due.filter((o) => now.toMillis() - o.at > lateGraceMs),
  };
}
