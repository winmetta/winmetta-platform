// What the bell logic needs from a platform (docs/meditation-bell.md §9). The web page implements it
// with the Web Audio API; a later desktop or mobile app implements it with its own sound and
// notifications, without changing the logic in this folder.
import type { Occurrence } from './schedule';

export interface BellPlayer {
  /** Ring `sound` `times` times now (strikes `ringSpacingSeconds` apart). */
  ring(sound: string, times: number): void;
  /** Tell the platform the next bells, for a platform that can ring them with the app closed. */
  schedule(next: readonly Occurrence[]): void;
  /** Cancel anything scheduled and stop any ringing. */
  cancel(): void;
}
