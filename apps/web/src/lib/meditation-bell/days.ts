// Days of the weekly schedule (docs/meditation-bell.md §4, §6.2). The week starts on Monday, as
// Luxon's weekday numbers do (1 = Monday ... 7 = Sunday).
export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof days)[number];

export const isDay = (value: string): value is Day =>
  (days as readonly string[]).includes(value);

/** Luxon weekday number (1-7) to a day. */
export const dayOfWeekday = (weekday: number): Day => days[weekday - 1] as Day;

export const weekdays: readonly Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
