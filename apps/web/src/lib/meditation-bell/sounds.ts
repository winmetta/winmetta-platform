// The fixed list of bell sounds (docs/meditation-bell.md §8). The app, the CSV and the analytics
// events all use these ids, so an id is never reused or renamed.
import type { MessageKey } from '../../i18n/messages';

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
}

export const sounds: readonly BellSound[] = [
  {
    id: 'winmetta-short',
    name: 'bellSoundWinmettaShort',
    file: null,
    seconds: null,
    licence: 'Win Metta',
  },
  {
    id: 'winmetta-long',
    name: 'bellSoundWinmettaLong',
    file: null,
    seconds: null,
    licence: 'Win Metta',
  },
];

export const soundIds: readonly string[] = sounds.map((sound) => sound.id);
export const isSoundId = (value: string): boolean => soundIds.includes(value);
export const soundById = (id: string): BellSound | undefined =>
  sounds.find((sound) => sound.id === id);

/** Defaults (§3.3): a short start bell once; a long end bell, three times. */
export const defaultStartSound = 'winmetta-short';
export const defaultEndSound = 'winmetta-long';
export const defaultEndRings = 3;

/** Each strike starts this long after the one before it (§8.1). */
export const ringSpacingSeconds = 5;

/** Start times, in seconds from the first strike, of a bell rung `rings` times. */
export const ringOffsets = (rings: number): number[] =>
  Array.from({ length: rings }, (_, i) => i * ringSpacingSeconds);
