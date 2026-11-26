// Sound previews you can stop: the Play buttons in Bells Settings, Ring now and the schedule form's
// Test sound. One preview plays at a time; `playing` says which button shows Stop.
import { useCallback, useEffect, useRef, useState } from 'react';
import { onPreviewEnd, ring, stopPreview } from './web-player';

/** Who is playing: the two settings rows, Ring now, or the schedule form's Test sound. */
export type PreviewRole = 'start' | 'end' | 'now' | 'test';

export interface Playing {
  role: PreviewRole;
  seconds: number;
}

export function usePreview(unlock: () => Promise<boolean>) {
  const [playing, setPlaying] = useState<Playing | undefined>();
  const timer = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    setPlaying(undefined);
  }, []);
  const stop = useCallback(() => {
    stopPreview();
    clear();
  }, [clear]);
  // Another ring (the alarm, a scheduled bell, another preview) cuts a preview short: follow it.
  useEffect(() => onPreviewEnd(clear), [clear]);
  useEffect(() => stop, [stop]);

  const preview = useCallback(
    (role: PreviewRole, sound: string, rings = 1) => {
      window.clearTimeout(timer.current);
      void unlock().then(async (ready) => {
        if (!ready || sound === 'off') return;
        const seconds = await ring(sound, rings, true);
        if (seconds <= 0) return;
        setPlaying({ role, seconds });
        timer.current = window.setTimeout(
          () => setPlaying(undefined),
          seconds * 1000,
        );
      });
    },
    [unlock],
  );

  return { playing, preview, stop };
}
