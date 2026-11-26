import { DateTime } from 'luxon';
import { useEffect, useEffectEvent } from 'react';
import type { BellEvent } from '../../lib/meditation-bell/events';
import { scheduleRing } from '../../lib/meditation-bell/events';
import { dayName, format12Hour } from '../../lib/meditation-bell/format';
import { dueBells } from '../../lib/meditation-bell/schedule';
import { storageKey, type BellState } from '../../lib/meditation-bell/schema';
import { ring } from './web-player';

type Schedule = BellState['schedule'];

interface Options {
  loaded: boolean;
  audioReady: boolean;
  on: boolean;
  getSchedule: () => Schedule;
  checkpoint: (at: number) => boolean;
  missed: (time: string, day: string) => void;
  send: (event: BellEvent) => void;
}

export function useWeeklyBells({
  loaded,
  audioReady,
  on,
  getSchedule,
  checkpoint,
  missed,
  send,
}: Options) {
  const check = useEffectEvent(() => {
    const schedule = getSchedule();
    if (!schedule.on || !audioReady) return;
    const now = DateTime.local();
    const at = now.toMillis();
    const last = schedule.checkedAt ?? at;
    if (at < last) return;
    // A weekly schedule repeats. After a long absence the latest week's missed bells suffice.
    const from = Math.max(last, now.minus({ days: 7 }).toMillis());
    const due = dueBells(schedule.week, DateTime.fromMillis(from), now);
    const latestMissed = due.missed.at(-1);
    const shouldSave =
      schedule.checkedAt === undefined ||
      due.ring.length > 0 ||
      latestMissed !== undefined ||
      at - last >= 60_000;
    if (shouldSave && !checkpoint(at)) return;
    if (latestMissed)
      missed(format12Hour(latestMissed.bell.time), dayName(latestMissed.day));
    for (const occurrence of due.ring) {
      void ring(occurrence.bell.sound, occurrence.bell.rings);
      send(scheduleRing());
    }
  });

  useEffect(() => {
    if (!loaded || !on || !audioReady) return;
    let active = true;
    const tick = () => {
      if (!navigator.locks) return check();
      void navigator.locks
        .request(storageKey, { ifAvailable: true }, (lock) => {
          if (lock && active) check();
        })
        .catch(() => undefined);
    };
    // Processing a missed bell while leaving can consume the notice before a reload.
    const wake = () => {
      if (document.visibilityState === 'visible') tick();
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', wake);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [loaded, on, audioReady]);
}
