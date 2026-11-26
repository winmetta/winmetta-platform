// Analytics events of the meditation bell (docs/meditation-bell.md §11, analytics.md §3). Every
// property comes from a fixed list or a bucket, so no free text, label, bell time or exact length
// can reach the tracker. Pure builders; the island passes the result to `track`.
import { isSoundId } from './sounds';
import type { TimerMode } from './timer';

export type LengthBucket =
  '1-5' | '6-15' | '16-30' | '31-60' | '61-120' | 'more';

/** Minutes to a bucket: 1–5, 6–15, 16–30, 31–60, 61–120 and more than 120. */
export function bucketLength(minutes: number): LengthBucket {
  if (minutes <= 5) return '1-5';
  if (minutes <= 15) return '6-15';
  if (minutes <= 30) return '16-30';
  if (minutes <= 60) return '31-60';
  if (minutes <= 120) return '61-120';
  return 'more';
}

type Event = { name: string; data: Record<string, string | number | boolean> };

export type StartSource = 'preset' | 'custom' | 'time';
export type EndHow = 'rang' | 'reset' | 'cleared' | 'missed';

export const timerStart = (
  mode: TimerMode,
  lengthMs: number,
  from: StartSource,
  startBell: boolean,
): Event => ({
  name: 'bell_timer_start',
  data: {
    mode,
    length: bucketLength(Math.ceil(lengthMs / 60_000)),
    from,
    start_bell: startBell,
  },
});

export const timerEnd = (mode: TimerMode, how: EndHow): Event => ({
  name: 'bell_timer_end',
  data: { mode, how },
});

export const ringNow = (view: 'timer' | 'schedule'): Event => ({
  name: 'bell_ring_now',
  data: { view },
});

/** `sound` is an id from the registry, or `off` for the start bell; anything else is not sent. */
export function soundChange(
  role: 'start' | 'end',
  sound: string,
  rings?: number,
): Event | undefined {
  if (sound !== 'off' && !isSoundId(sound)) return undefined;
  if (sound === 'off' && role === 'end') return undefined;
  const data: Event['data'] = { role, sound };
  if (role === 'end' && rings !== undefined) data.rings = rings;
  return { name: 'bell_sound_change', data };
}
