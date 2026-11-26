import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { alarmAfterMinutes, atClock, nextAlarm, parseClock } from './alarm';

const la = (iso: string) =>
  DateTime.fromISO(iso, { zone: 'America/Los_Angeles' });

describe('nextAlarm', () => {
  it('rings today when the time is still ahead', () => {
    const r = nextAlarm('21:00', la('2026-11-25T19:00:00'));
    expect(r).toMatchObject({ ok: true, when: 'today', msUntil: 2 * 3600_000 });
  });
  it('rings tomorrow when the time has passed today', () => {
    const r = nextAlarm('06:00', la('2026-11-25T19:00:00'));
    expect(r).toMatchObject({
      ok: true,
      when: 'tomorrow',
      msUntil: 11 * 3600_000,
    });
  });
  it('refuses a time more than 16 hours away', () => {
    expect(nextAlarm('14:00', la('2026-11-25T19:00:00'))).toEqual({
      ok: false,
      reason: 'too-far',
    });
  });
  it('allows exactly 16 hours', () => {
    expect(nextAlarm('11:00', la('2026-11-25T19:00:00'))).toMatchObject({
      ok: true,
    });
  });
  it('treats the current minute as passed', () => {
    expect(nextAlarm('19:00', la('2026-11-25T19:00:00'))).toMatchObject({
      ok: false,
      reason: 'too-far',
    });
  });
  it('rejects invalid clock text', () => {
    expect(nextAlarm('24:00', la('2026-11-25T19:00:00'))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(nextAlarm('6:00', la('2026-11-25T19:00:00'))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
  it('moves a time in the spring-forward gap to the next valid minute', () => {
    // 2026-03-08: 02:00-03:00 does not exist in Los Angeles.
    const r = nextAlarm('02:30', la('2026-03-07T22:00:00'));
    expect(
      r.ok &&
        DateTime.fromMillis(r.at, { zone: 'America/Los_Angeles' }).toFormat(
          'HH:mm',
        ),
    ).toBe('03:00');
  });
});

describe('alarmAfterMinutes', () => {
  it('rounds to the nearest minute', () => {
    expect(
      alarmAfterMinutes(10, la('2026-11-25T19:00:20')).toFormat('HH:mm:ss'),
    ).toBe('19:10:00');
    expect(
      alarmAfterMinutes(10, la('2026-11-25T19:00:40')).toFormat('HH:mm:ss'),
    ).toBe('19:11:00');
  });
});

describe('parseClock / atClock', () => {
  it('parses HH:MM only', () => {
    expect(parseClock('06:05')).toEqual([6, 5]);
    expect(parseClock('6:05')).toBeUndefined();
  });
  it('keeps 6:00 as 6:00 across a daylight-saving change', () => {
    const before = atClock(la('2026-10-31T00:00:00').startOf('day'), [6, 0]);
    const after = atClock(la('2026-11-01T00:00:00').startOf('day'), [6, 0]);
    expect(before.toFormat('HH:mm')).toBe('06:00');
    expect(after.toFormat('HH:mm')).toBe('06:00');
    expect(before.offset).not.toBe(after.offset);
  });
});
