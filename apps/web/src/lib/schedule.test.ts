import { describe, expect, it } from 'vitest';
import { occurrenceOn, formatOccurrence, formatNumber } from './schedule';
const saturday = { timezone: 'America/Los_Angeles', weekday: 6, time: '18:30' };
describe('weekly class occurrences', () => {
  it('keeps Pacific wall time as daylight saving starts and ends', () => {
    expect(occurrenceOn(saturday, '2026-03-07').toISOString()).toBe(
      '2026-03-08T02:30:00.000Z',
    );
    expect(occurrenceOn(saturday, '2026-03-14').toISOString()).toBe(
      '2026-03-15T01:30:00.000Z',
    );
    expect(occurrenceOn(saturday, '2026-10-31').toISOString()).toBe(
      '2026-11-01T01:30:00.000Z',
    );
    expect(occurrenceOn(saturday, '2026-11-07').toISOString()).toBe(
      '2026-11-08T02:30:00.000Z',
    );
  });
  it('rolls Pacific Saturday into Myanmar Sunday regardless of process timezone', () => {
    const instant = occurrenceOn(saturday, '2026-03-07');
    expect(formatOccurrence(instant, 'en', 'Asia/Yangon')).toMatch(
      /Sunday.*Mar 8, 2026.*9:00/,
    );
    expect(formatOccurrence(instant, 'en', 'America/Los_Angeles')).toMatch(
      /Saturday.*Mar 7, 2026.*6:30/,
    );
    expect(formatOccurrence(instant, 'my', 'Asia/Yangon')).toMatch(
      /[\u1000-\u109f]/,
    );
    expect(formatNumber(123, 'my')).toBe('123');
  });
  it('rejects nonexistent DST times and resolves repeats to the earlier instant', () => {
    expect(() =>
      occurrenceOn({ ...saturday, weekday: 7, time: '02:30' }, '2026-03-08'),
    ).toThrow('does not exist');
    expect(
      occurrenceOn(
        { ...saturday, weekday: 7, time: '01:30' },
        '2026-11-01',
      ).toISOString(),
    ).toBe('2026-11-01T08:30:00.000Z');
  });
  it('validates source timezone, date and weekday', () => {
    expect(() =>
      occurrenceOn({ ...saturday, timezone: 'invalid' }, '2026-03-07'),
    ).toThrow();
    expect(() => occurrenceOn(saturday, '2026-03-08')).toThrow('recurrence');
    expect(() => occurrenceOn(saturday, '2026-02-30')).toThrow();
  });
});
