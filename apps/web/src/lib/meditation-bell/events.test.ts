import { describe, expect, it } from 'vitest';
import {
  bucketLength,
  conflict,
  csv,
  scheduleEdit,
  scheduleRing,
  scheduleSwitch,
  ringNow,
  soundChange,
  timerEnd,
  timerStart,
} from './events';

describe('events', () => {
  it('buckets lengths at the plan boundaries', () => {
    const cases: [number, string][] = [
      [1, '1-5'],
      [5, '1-5'],
      [6, '6-15'],
      [15, '6-15'],
      [16, '16-30'],
      [30, '16-30'],
      [31, '31-60'],
      [60, '31-60'],
      [61, '61-120'],
      [120, '61-120'],
      [121, 'more'],
      [960, 'more'],
    ];
    for (const [minutes, bucket] of cases)
      expect(bucketLength(minutes), String(minutes)).toBe(bucket);
  });

  it('never carries the exact length: only bucket, mode and flags', () => {
    expect(timerStart('countdown', 20 * 60_000, 'preset', true)).toEqual({
      name: 'bell_timer_start',
      data: {
        mode: 'countdown',
        length: '16-30',
        from: 'preset',
        start_bell: true,
      },
    });
    expect(
      timerStart('alarm', 61 * 60_000 + 1, 'time', false).data.length,
    ).toBe('61-120');
  });

  it('reports how a timer ended and where the manual bell was used', () => {
    expect(timerEnd('alarm', 'missed')).toEqual({
      name: 'bell_timer_end',
      data: { mode: 'alarm', how: 'missed' },
    });
    expect(ringNow('timer').data).toEqual({ view: 'timer' });
  });

  it('reports weekly schedule activity without exact counts or schedule contents', () => {
    expect(scheduleSwitch(true, 16).data).toEqual({ on: true, bells: '6-20' });
    expect(scheduleEdit('edit', 4).data).toEqual({
      action: 'edit',
      days: '2-6',
    });
    expect(scheduleRing().data).toEqual({});
    expect(conflict('schedule_on', 'cancel').data).toEqual({
      kind: 'schedule_on',
      choice: 'cancel',
    });
    expect(csv('import', true, 7, true, 'add').data).toEqual({
      action: 'import',
      ok: true,
      bells: '6-20',
      skipped: true,
      how: 'add',
    });
    expect(csv('export', true, 0, false).data).toEqual({
      action: 'export',
      ok: true,
      bells: '0',
      skipped: false,
    });
  });

  it('sends only registered sounds, and off only for the start bell', () => {
    expect(soundChange('end', 'winmetta-long', 3)?.data).toEqual({
      role: 'end',
      sound: 'winmetta-long',
      rings: 3,
    });
    expect(soundChange('start', 'off')?.data).toEqual({
      role: 'start',
      sound: 'off',
    });
    expect(soundChange('start', 'winmetta-short', 2)?.data).toEqual({
      role: 'start',
      sound: 'winmetta-short',
    });
    expect(soundChange('end', 'off')).toBeUndefined();
    expect(soundChange('end', 'my own label')).toBeUndefined();
  });
});
