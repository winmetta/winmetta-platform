import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  addBell,
  bellCount,
  deleteBell,
  dueBells,
  editBell,
  emptyWeek,
  nextBell,
  occurrencesBetween,
  validateBell,
  type Bell,
} from './schedule';

const la = (iso: string) =>
  DateTime.fromISO(iso, { zone: 'America/Los_Angeles' });
const bell = (id: string, time: string, extra: Partial<Bell> = {}): Bell => ({
  id,
  time,
  label: '',
  sound: 'winmetta-long',
  rings: 3,
  ...extra,
});
const added = (
  week = emptyWeek(),
  b: Bell,
  on: Parameters<typeof addBell>[2],
) => {
  const r = addBell(week, b, on);
  if ('error' in r) throw new Error(r.error.kind);
  return r.week;
};

describe('add, edit and delete', () => {
  it('saves a bell on every chosen day, sorted by time', () => {
    let w = added(emptyWeek(), bell('a', '09:00'), ['Mon', 'Tue']);
    w = added(w, bell('b', '06:00'), ['Mon']);
    expect(w.Mon.map((b) => b.time)).toEqual(['06:00', '09:00']);
    expect(w.Tue).toHaveLength(1);
    expect(bellCount(w)).toBe(3);
  });
  it('names the day of a duplicate time and changes nothing', () => {
    const w = added(emptyWeek(), bell('a', '06:00'), ['Tue']);
    const r = addBell(w, bell('b', '06:00'), ['Mon', 'Tue']);
    expect(r).toEqual({
      error: { kind: 'duplicate', day: 'Tue', time: '06:00' },
    });
    expect(w.Mon).toHaveLength(0);
  });
  it('reports no time, no day, bad rings and long labels', () => {
    expect(validateBell(bell('a', ''), ['Mon'])).toEqual({ kind: 'no-time' });
    expect(validateBell(bell('a', '06:00'), [])).toEqual({ kind: 'no-day' });
    expect(validateBell(bell('a', '06:00', { rings: 4 }), ['Mon'])).toEqual({
      kind: 'invalid-rings',
    });
    expect(
      validateBell(bell('a', '06:00', { label: 'x'.repeat(41) }), ['Mon']),
    ).toEqual({
      kind: 'label-too-long',
    });
  });
  it('edits a bell and moves it to other days', () => {
    const w = added(emptyWeek(), bell('a', '06:00'), ['Mon', 'Tue']);
    const r = editBell(w, bell('a', '06:30'), ['Tue', 'Wed']);
    if ('error' in r) throw new Error(r.error.kind);
    expect(r.week.Mon).toHaveLength(0);
    expect(r.week.Tue[0]?.time).toBe('06:30');
    expect(r.week.Wed[0]?.time).toBe('06:30');
  });
  it('allows saving an edited bell on its own time', () => {
    const w = added(emptyWeek(), bell('a', '06:00'), ['Mon']);
    expect(
      'week' in editBell(w, bell('a', '06:00', { label: 'new' }), ['Mon']),
    ).toBe(true);
  });
  it('deletes from every day', () => {
    const w = added(emptyWeek(), bell('a', '06:00'), ['Mon', 'Tue']);
    expect(bellCount(deleteBell(w, 'a'))).toBe(0);
  });
});

describe('next bell', () => {
  const week = added(
    added(emptyWeek(), bell('a', '06:00'), ['Mon', 'Wed']),
    bell('b', '19:00'),
    ['Sun'],
  );
  it('finds the next bell across the week', () => {
    // 2026-11-25 is a Wednesday.
    const n = nextBell(week, la('2026-11-25T08:00:00'));
    expect(n?.day).toBe('Sun');
    expect(
      DateTime.fromMillis(n!.at, { zone: 'America/Los_Angeles' }).toISO(),
    ).toContain('2026-11-29T19:00');
  });
  it('wraps to next week and ignores a bell at this exact minute', () => {
    const n = nextBell(week, la('2026-11-29T19:00:00'));
    expect(n?.day).toBe('Mon');
  });
  it('is undefined for an empty schedule', () => {
    expect(nextBell(emptyWeek(), la('2026-11-25T08:00:00'))).toBeUndefined();
  });
});

describe('daylight saving (America/Los_Angeles)', () => {
  it('rings a skipped 02:30 at the next valid minute on spring-forward day', () => {
    const w = added(emptyWeek(), bell('a', '02:30'), ['Sun']);
    const n = nextBell(w, la('2026-03-07T12:00:00')); // 2026-03-08 is a Sunday
    expect(
      DateTime.fromMillis(n!.at, { zone: 'America/Los_Angeles' }).toFormat(
        'yyyy-MM-dd HH:mm',
      ),
    ).toBe('2026-03-08 03:00');
  });
  it('rings a doubled 01:30 once on fall-back day', () => {
    const w = added(emptyWeek(), bell('a', '01:30'), ['Sun']);
    const all = occurrencesBetween(
      w,
      la('2026-10-31T12:00:00'),
      la('2026-11-01T12:00:00'),
    );
    expect(all).toHaveLength(1);
  });
  it('keeps 06:00 at 06:00 on both sides of the change', () => {
    const w = added(emptyWeek(), bell('a', '06:00'), ['Sat', 'Sun', 'Mon']);
    const all = occurrencesBetween(
      w,
      la('2026-10-31T00:00:00'),
      la('2026-11-02T23:00:00'),
    );
    const times = all.map((o) =>
      DateTime.fromMillis(o.at, { zone: 'America/Los_Angeles' }).toFormat(
        'HH:mm',
      ),
    );
    expect(times).toEqual(['06:00', '06:00', '06:00']);
  });
});

describe('dueBells (missed-bell rule)', () => {
  const w = added(emptyWeek(), bell('a', '06:00'), ['Wed']);
  it('rings a bell that fell due two minutes ago or less', () => {
    const d = dueBells(w, la('2026-11-25T05:50:00'), la('2026-11-25T06:02:00'));
    expect(d.ring).toHaveLength(1);
    expect(d.missed).toHaveLength(0);
  });
  it('reports an older bell as missed, not rung', () => {
    const d = dueBells(w, la('2026-11-25T05:50:00'), la('2026-11-25T06:03:00'));
    expect(d.ring).toHaveLength(0);
    expect(d.missed).toHaveLength(1);
  });
  it('does nothing when no bell fell due', () => {
    const d = dueBells(w, la('2026-11-25T06:01:00'), la('2026-11-25T06:05:00'));
    expect(d).toEqual({ ring: [], missed: [] });
  });
});
