// "Ring at" a clock time (docs/meditation-bell.md §3.2): the next time that clock time occurs,
// at most 16 hours ahead.
import { DateTime } from 'luxon';

export const maxAlarmHours = 16;
export const maxAlarmMs = maxAlarmHours * 60 * 60 * 1000;

export type AlarmResult =
  | { ok: true; at: number; when: 'today' | 'tomorrow'; msUntil: number }
  | { ok: false; reason: 'invalid' | 'too-far' };

/** Parses `HH:MM` (24-hour). */
export function parseClock(time: string): [number, number] | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

/**
 * The next occurrence of `time` after `now`. A time that has passed today means tomorrow. A time
 * more than 16 hours away is refused. A time in a daylight-saving gap rings at the next valid minute.
 */
export function nextAlarm(time: string, now: DateTime): AlarmResult {
  const clock = parseClock(time);
  if (!clock) return { ok: false, reason: 'invalid' };
  const today = atClock(now.startOf('day'), clock);
  const date =
    today > now ? today : atClock(now.startOf('day').plus({ days: 1 }), clock);
  const msUntil = date.toMillis() - now.toMillis();
  if (msUntil > maxAlarmMs) return { ok: false, reason: 'too-far' };
  return {
    ok: true,
    at: date.toMillis(),
    when: date.hasSame(now, 'day') ? 'today' : 'tomorrow',
    msUntil,
  };
}

/** Now plus `minutes`, rounded to the minute (the alarm presets "+N minutes from now"). */
export function alarmAfterMinutes(minutes: number, now: DateTime): DateTime {
  return now.plus({ minutes, seconds: 30 }).startOf('minute');
}

/**
 * A wall-clock time on `day` (a start-of-day). A time skipped by a daylight-saving change moves to
 * the next valid minute: Luxon shifts it forward by the gap, so the result is cut back to the hour.
 */
export function atClock(
  day: DateTime,
  [hour, minute]: [number, number],
): DateTime {
  const date = day.set({ hour, minute, second: 0, millisecond: 0 });
  return date.hour === hour && date.minute === minute
    ? date
    : date.startOf('hour');
}
