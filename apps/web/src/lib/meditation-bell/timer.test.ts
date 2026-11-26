import { describe, expect, it } from 'vitest';
import {
  createTimer,
  lateGraceMs,
  minutesToMs,
  msLeft,
  parseMinutes,
  pause,
  reset,
  resume,
  start,
  tick,
} from './timer';

const T0 = 1_000_000;

describe('parseMinutes', () => {
  it('accepts whole minutes 1 to 960 only', () => {
    expect(parseMinutes('1')).toBe(1);
    expect(parseMinutes(' 960 ')).toBe(960);
    for (const bad of ['0', '961', '-5', '1.5', '', 'abc', '1e2'])
      expect(parseMinutes(bad), bad).toBeUndefined();
  });
});

describe('timer', () => {
  const ready = () => createTimer('countdown', minutesToMs(20));

  it('stores the end as an absolute moment', () => {
    const t = start(ready(), T0);
    expect(t).toMatchObject({ status: 'running', endAt: T0 + 20 * 60_000 });
    expect(msLeft(t, T0 + 60_000)).toBe(19 * 60_000);
  });
  it('does nothing before the end', () => {
    const t = start(ready(), T0);
    expect(tick(t, T0 + 20 * 60_000 - 1)).toEqual({ timer: t });
  });
  it('rings at the end', () => {
    const r = tick(start(ready(), T0), T0 + 20 * 60_000);
    expect(r.event).toBe('rang');
    expect(r.timer.status).toBe('finished');
  });
  it('still rings up to two minutes late, then reports missed', () => {
    const t = start(ready(), T0);
    const end = T0 + 20 * 60_000;
    expect(tick(t, end + lateGraceMs).event).toBe('rang');
    const late = tick(t, end + lateGraceMs + 1);
    expect(late.event).toBe('missed');
    expect(late.timer.status).toBe('missed');
  });
  it('pauses with the time left and resumes from a new end', () => {
    const paused = pause(start(ready(), T0), T0 + 5 * 60_000);
    expect(paused).toMatchObject({
      status: 'paused',
      endAt: null,
      remainingMs: 15 * 60_000,
    });
    expect(tick(paused, T0 + 999_999_999).event).toBeUndefined();
    const resumed = resume(paused, T0 + 60 * 60_000);
    expect(resumed.endAt).toBe(T0 + 60 * 60_000 + 15 * 60_000);
  });
  it('resets to the chosen length and can start again after finishing', () => {
    const finished = tick(start(ready(), T0), T0 + 20 * 60_000).timer;
    expect(start(finished, T0 + 1).status).toBe('running');
    expect(reset(start(ready(), T0))).toEqual(ready());
  });
  it('ignores start on a running timer and pause on an idle one', () => {
    const running = start(ready(), T0);
    expect(start(running, T0 + 5)).toBe(running);
    const idle = ready();
    expect(pause(idle, T0)).toBe(idle);
    expect(resume(idle, T0)).toBe(idle);
  });
  it('shows the full length when idle', () => {
    expect(msLeft(ready(), T0)).toBe(20 * 60_000);
  });
});
