// Display helpers (docs/meditation-bell.md §3.1, §7.2). Western digits in both locales.
import type { Day } from './days';

/** Minutes and seconds, with up to three minute digits and optional millisecond precision. */
export function formatCountdown(ms: number, milliseconds = false): string {
  const remaining = Math.max(0, Math.ceil(ms));
  const seconds = milliseconds
    ? Math.floor(remaining / 1000)
    : Math.ceil(remaining / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const whole = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  return milliseconds
    ? `${whole}.${String(remaining % 1000).padStart(3, '0')}`
    : whole;
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
