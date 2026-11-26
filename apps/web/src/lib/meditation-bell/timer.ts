// The countdown and alarm state machine (docs/meditation-bell.md §3.4). Pure: every function takes
// the current time in milliseconds since the epoch, so tests control the clock. A running timer
// stores its end as an absolute moment, never a count of ticks.

export const minMinutes = 1;
export const maxMinutes = 960;
/** A bell that was due this long ago or less still rings on return (§3.4). */
export const lateGraceMs = 2 * 60 * 1000;

export type TimerMode = 'countdown' | 'alarm';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished' | 'missed';

export interface Timer {
  mode: TimerMode;
  status: TimerStatus;
  /** The chosen length (a countdown) or the time from the start to the alarm. */
  lengthMs: number;
  /** When it rings; only while running. */
  endAt: number | null;
  /** Time left; only while paused. */
  remainingMs: number | null;
}

/** Whole minutes from 1 to 960, or undefined (§3.1). */
export function parseMinutes(value: string | number): number | undefined {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return undefined;
  const minutes = Number(text);
  return minutes >= minMinutes && minutes <= maxMinutes ? minutes : undefined;
}

export const minutesToMs = (minutes: number): number => minutes * 60_000;

export const createTimer = (mode: TimerMode, lengthMs: number): Timer => ({
  mode,
  status: 'idle',
  lengthMs,
  endAt: null,
  remainingMs: null,
});

/** Start from idle or finished. For an alarm, `lengthMs` is the time until it rings. */
export function start(timer: Timer, now: number): Timer {
  if (
    timer.status !== 'idle' &&
    timer.status !== 'finished' &&
    timer.status !== 'missed'
  )
    return timer;
  return {
    ...timer,
    status: 'running',
    endAt: now + timer.lengthMs,
    remainingMs: null,
  };
}

export function pause(timer: Timer, now: number): Timer {
  if (timer.status !== 'running' || timer.endAt === null) return timer;
  return {
    ...timer,
    status: 'paused',
    endAt: null,
    remainingMs: Math.max(0, timer.endAt - now),
  };
}

/** Resume computes a new end from the time left. */
export function resume(timer: Timer, now: number): Timer {
  if (timer.status !== 'paused' || timer.remainingMs === null) return timer;
  return {
    ...timer,
    status: 'running',
    endAt: now + timer.remainingMs,
    remainingMs: null,
  };
}

/** Back to the chosen length, stopped. */
export const reset = (timer: Timer): Timer =>
  createTimer(timer.mode, timer.lengthMs);

export const msLeft = (timer: Timer, now: number): number =>
  timer.status === 'running' && timer.endAt !== null
    ? Math.max(0, timer.endAt - now)
    : timer.status === 'paused'
      ? (timer.remainingMs ?? 0)
      : timer.status === 'idle'
        ? timer.lengthMs
        : 0;

export type TimerEvent = 'rang' | 'missed';

/**
 * Has the end passed? A bell due two minutes ago or less rings; an older one does not and is
 * reported as missed (the page was asleep or closed).
 */
export function tick(
  timer: Timer,
  now: number,
): { timer: Timer; event?: TimerEvent } {
  if (timer.status !== 'running' || timer.endAt === null || now < timer.endAt)
    return { timer };
  const late = now - timer.endAt;
  const event: TimerEvent = late <= lateGraceMs ? 'rang' : 'missed';
  return {
    timer: {
      ...timer,
      status: event === 'rang' ? 'finished' : 'missed',
      endAt: null,
      remainingMs: null,
    },
    event,
  };
}
