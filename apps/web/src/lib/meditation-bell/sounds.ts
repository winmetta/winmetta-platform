// The fixed list of bell sounds (docs/meditation-bell.md §8). The app, the CSV and the analytics
// events all use these ids, so an id is never reused or renamed.
import type { MessageKey } from '../../i18n/messages';

/** A generated tone: pitch in Hz, decay in seconds, and an optional beating twin (Hz) for a larger bell. */
export interface Synth {
  base: number;
  decay: number;
  shimmer?: number;
}

export interface BellSound {
  /** Stable id: stored state, CSV `sound` column, analytics. */
  id: string;
  /** Message key of the display name. */
  name: MessageKey;
  /**
   * File name under public/audio/ (with its content hash), or null until the sound is added.
   * The WinMetta sounds stay null until Win Metta's ownership of the recording is confirmed
   * (§8.1) and scripts/make-bell-sounds.sh has produced them.
   */
  file: string | null;
  /** Length of one strike in seconds, from the prepared file. */
  seconds: number | null;
  licence: string;
  /**
   * The generated tone (pitch in Hz, decay in seconds). Played when `file` is null: always for the
   * built-in chimes (§8.1), and for a recorded sound until its file exists.
   */
  synth: Synth;
}

export const sounds: readonly BellSound[] = [
  {
    id: 'soft-chime',
    name: 'bellSoundSoftChime',
    file: null,
    seconds: null,
    licence: 'Generated in the app',
    synth: { base: 294, decay: 2.2 },
  },
  {
    id: 'deep-chime',
    name: 'bellSoundDeepChime',
    file: null,
    seconds: null,
    licence: 'Generated in the app',
    synth: { base: 196, decay: 4.5 },
  },
  {
    id: 'long-chime',
    name: 'bellSoundLongChime',
    file: null,
    seconds: null,
    licence: 'Generated in the app',
    synth: { base: 174, decay: 10, shimmer: 1.2 },
  },
];

export const soundIds: readonly string[] = sounds.map((sound) => sound.id);
export const isSoundId = (value: string): boolean => soundIds.includes(value);
export const soundById = (id: string): BellSound | undefined =>
  sounds.find((sound) => sound.id === id);

/** Defaults (§3.3): a short start bell once; a long end bell, three times. */
export const defaultStartSound = 'off';
export const defaultEndSound = 'long-chime';
export const defaultEndRings = 3;

/** Each strike starts this long after the one before it (§8.1). */
export const ringSpacingSeconds = 5;

/** Start times, in seconds from the first strike, of a bell rung `rings` times. */
export const ringOffsets = (rings: number): number[] =>
  Array.from({ length: rings }, (_, i) => i * ringSpacingSeconds);
