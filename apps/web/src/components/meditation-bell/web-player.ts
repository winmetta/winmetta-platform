// The web bell player (docs/meditation-bell.md §3.4, §8.4, §9): Web Audio for the sound, the Screen
// Wake Lock API to keep the screen on while a timer runs. The bell logic never touches these.
import { ringOffsets, soundById } from '../../lib/meditation-bell/sounds';

type Ctx = AudioContext;
let context: Ctx | undefined;
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();

function audioContext(): Ctx | undefined {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return undefined;
  context = new Ctor();
  return context;
}

/** Browsers only allow sound after a tap: call this from Start, a preset or Ring bell now. */
export async function unlockAudio(): Promise<void> {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended')
    await ctx.resume().catch(() => undefined);
}

/** Sounds load when first needed, never on page load, and only the ones in use. */
function loadBuffer(ctx: Ctx, id: string): Promise<AudioBuffer | undefined> {
  const file = soundById(id)?.file;
  if (!file) return Promise.resolve(undefined);
  let pending = buffers.get(id);
  if (!pending) {
    pending = fetch(`/audio/${file}`)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => undefined);
    buffers.set(id, pending);
  }
  return pending;
}

/**
 * A plain struck-bell tone, used while a sound has no recording yet (the WinMetta files wait for
 * confirmation that Win Metta owns the recording, §8.1): a low strike with inharmonic partials
 * that fade out, so the bell can be tried before the real sounds exist.
 */
function synthesize(ctx: Ctx, id: string, at: number): void {
  const long = id.endsWith('long');
  const base = long ? 196 : 294;
  const decay = long ? 4.5 : 2.2;
  const partials: [number, number][] = [
    [1, 1],
    [2.01, 0.5],
    [2.76, 0.35],
    [5.4, 0.18],
    [8.93, 0.08],
  ];
  const master = ctx.createGain();
  master.gain.value = 0.4;
  master.connect(ctx.destination);
  for (const [ratio, level] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = base * ratio;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay / ratio ** 0.5);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + decay + 0.1);
  }
}

/** Ring `sound` `times` times, the strikes `ringSpacingSeconds` apart. */
export async function ring(sound: string, times: number): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return;
  await unlockAudio();
  const buffer = await loadBuffer(ctx, sound);
  const start = ctx.currentTime + 0.05;
  for (const offset of ringOffsets(times)) {
    if (!buffer) {
      synthesize(ctx, sound, start + offset);
      continue;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(start + offset);
  }
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};
let lock: WakeLockSentinelLike | undefined;
let requesting = false;

/** Keep the screen on while a timer runs and the page is visible (where supported). */
export async function keepScreenOn(on: boolean): Promise<void> {
  const wakeLock = (
    navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }
  ).wakeLock;
  if (!on) {
    const held = lock;
    lock = undefined;
    await held?.release().catch(() => undefined);
    return;
  }
  // `requesting` stops two overlapping calls from each taking a lock and leaking one.
  if (!wakeLock || lock || requesting || document.visibilityState !== 'visible')
    return;
  requesting = true;
  try {
    const sentinel = await wakeLock.request('screen').catch(() => undefined);
    if (!sentinel) return;
    // The browser releases it by itself when the page is hidden: forget it, so coming back asks again.
    sentinel.addEventListener('release', () => {
      if (lock === sentinel) lock = undefined;
    });
    lock = sentinel;
  } finally {
    requesting = false;
  }
}
