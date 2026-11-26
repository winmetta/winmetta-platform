// Display helpers (docs/meditation-bell.md §3.1, §7.2). Western digits in both locales.
import { days as allDays, weekdays, type Day } from './days';

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

/** How long until a bell: `5 min`, `2 h 22 min`, `1 d 3 h`. Rounds up, so it never says 0 min. */
export function formatUntil(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
  }
  const hours = Math.floor((minutes % 1440) / 60);
  return `${Math.floor(minutes / 1440)} d${hours ? ` ${hours} h` : ''}`;
}

export type DaySummary =
  { kind: 'every' } | { kind: 'weekdays' } | { kind: 'list'; text: string };

/** The days a bell runs on: every day, weekdays, or runs like `Mon–Wed, Sat`. */
export function summarizeDays(selected: readonly Day[]): DaySummary {
  const chosen = allDays.filter((day) => selected.includes(day));
  if (chosen.length === allDays.length) return { kind: 'every' };
  if (
    chosen.length === weekdays.length &&
    weekdays.every((day) => chosen.includes(day))
  )
    return { kind: 'weekdays' };
  const parts: string[] = [];
  for (let i = 0; i < chosen.length;) {
    let end = i;
    while (
      end + 1 < chosen.length &&
      allDays.indexOf(chosen[end + 1] as Day) ===
        allDays.indexOf(chosen[end] as Day) + 1
    )
      end++;
    if (end - i >= 2) parts.push(`${chosen[i]}–${chosen[end]}`);
    else for (let j = i; j <= end; j++) parts.push(chosen[j] as string);
    i = end + 1;
  }
  return { kind: 'list', text: parts.join(', ') };
}
