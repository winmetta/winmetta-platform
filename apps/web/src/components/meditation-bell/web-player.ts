// The web bell player (docs/meditation-bell.md §3.4, §8.4, §9): Web Audio for the sound, the Screen
// Wake Lock API to keep the screen on while a timer runs. The bell logic never touches these.
import {
  ringOffsets,
  soundById,
  type Synth,
} from '../../lib/meditation-bell/sounds';

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

export const audioIsUnlocked = (): boolean => context?.state === 'running';

/** Browsers only allow sound after a tap: call this from Start, a preset or Ring bell now. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended')
    await ctx.resume().catch(() => undefined);
  return ctx?.state === 'running';
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
 * A plain struck-bell tone made in the browser, for the built-in chimes and, until their files
 * exist, the Win Metta sounds (§8.1): a strike with inharmonic partials that fade out.
 */
function synthesize(
  ctx: Ctx,
  { base, decay, shimmer = 0 }: Synth,
  at: number,
  out: AudioNode,
): void {
  const partials: [number, number][] = [
    [1, 1],
    [2.01, 0.5],
    [2.76, 0.35],
    [5.4, 0.18],
    [8.93, 0.08],
  ];
  const master = ctx.createGain();
  master.gain.value = 0.4;
  master.connect(out);
  // A twin of each partial a little off pitch makes the slow beating ("shimmer") of a large bell.
  const twins = shimmer > 0 ? [0, shimmer] : [0];
  for (const [ratio, level] of partials) {
    for (const detune of twins) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = base * ratio + detune * ratio;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(
        level / twins.length,
        at + (shimmer > 0 ? 0.03 : 0.01),
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay / ratio ** 0.5);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + decay + 0.1);
    }
  }
}

let previewOut: GainNode | undefined;
const previewEndListeners = new Set<() => void>();

/** Called whenever a preview is cut short (by Stop or by another ring). Returns an unsubscribe. */
export function onPreviewEnd(listener: () => void): () => void {
  previewEndListeners.add(listener);
  return () => previewEndListeners.delete(listener);
}

/** Stop a preview now, with a very short fade so there is no click. */
export function stopPreview(): void {
  const out = previewOut;
  const ctx = context;
  previewOut = undefined;
  if (!out || !ctx) return;
  out.gain.cancelScheduledValues(ctx.currentTime);
  out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
  out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
  window.setTimeout(() => out.disconnect(), 150);
  for (const listener of previewEndListeners) listener();
}

/**
 * Ring `sound` `times` times, the strikes `ringSpacingSeconds` apart. Resolves with the seconds
 * until it ends. A `preview` ring can be cut short with `stopPreview()`.
 */
export async function ring(
  sound: string,
  times: number,
  preview = false,
): Promise<number> {
  const ctx = audioContext();
  if (!ctx) return 0;
  await unlockAudio();
  stopPreview();
  let out: AudioNode = ctx.destination;
  if (preview) {
    previewOut = ctx.createGain();
    previewOut.connect(ctx.destination);
    out = previewOut;
  }
  const buffer = await loadBuffer(ctx, sound);
  const start = ctx.currentTime + 0.05;
  const offsets = ringOffsets(times);
  const tone: Synth = soundById(sound)?.synth ?? { base: 294, decay: 2.2 };
  const tail = buffer ? buffer.duration : tone.decay + 0.1;
  for (const offset of offsets) {
    if (!buffer) {
      synthesize(ctx, tone, start + offset, out);
      continue;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(out);
    source.start(start + offset);
  }
  return 0.05 + Math.max(...offsets) + tail;
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};
let lock: WakeLockSentinelLike | undefined;
let requesting = false;
let wantsScreenOn = false;

/** Keep the screen on while a timer runs and the page is visible (where supported). */
export async function keepScreenOn(on: boolean): Promise<void> {
  wantsScreenOn = on;
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
    if (!wantsScreenOn) {
      await sentinel.release().catch(() => undefined);
      return;
    }
    // The browser releases it by itself when the page is hidden: forget it, so coming back asks again.
    sentinel.addEventListener('release', () => {
      if (lock === sentinel) lock = undefined;
    });
    lock = sentinel;
  } finally {
    requesting = false;
  }
}
