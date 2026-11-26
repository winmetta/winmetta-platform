// Reading and writing the bell's one localStorage value (docs/meditation-bell.md §6.1). The pure
// parsing and schema live in lib/meditation-bell/schema.ts; this is the browser side.
import {
  backupKey,
  readState,
  storageKey,
  writeState,
  type BellState,
} from '../../lib/meditation-bell/schema';

export type LoadResult = {
  state: BellState;
  /** `broken`: an unreadable value was kept under the backup key. `blocked`: storage is unavailable. */
  problem?: 'broken' | 'blocked';
};

export function loadState(): LoadResult {
  try {
    const result = readState(window.localStorage.getItem(storageKey));
    if (result.status === 'broken') {
      // Never delete an unreadable value: keep it aside for a person to look at.
      window.localStorage.setItem(backupKey, result.raw);
      return { state: result.state, problem: 'broken' };
    }
    return { state: result.state };
  } catch {
    return { state: readState(null).state, problem: 'blocked' };
  }
}

/** False when the browser blocks storage, so the caller can say the settings are not saved. */
export function saveState(state: BellState): boolean {
  try {
    window.localStorage.setItem(storageKey, writeState(state));
    return true;
  } catch {
    return false;
  }
}
