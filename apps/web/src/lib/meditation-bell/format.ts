// Display helpers (docs/meditation-bell.md §3.1, §7.2). Western digits in both locales.
import type { Day } from './days';

/** `mm:ss`, or `mmm:ss` from 100 minutes up (`09:00`, `120:00`). Rounds up to the next second. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** `6:00 AM`, `12:30 PM`; input is 24-hour `HH:MM`. */
export function format12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export type DayLength = 'full' | 'short' | 'narrow';

const full: Record<Day, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

/** "Monday", "Mon" or "Mo": the longest that fits is chosen by the UI (§7.2). */
export function dayName(day: Day, length: DayLength = 'full'): string {
  if (length === 'full') return full[day];
  return day.slice(0, length === 'short' ? 3 : 2);
}
