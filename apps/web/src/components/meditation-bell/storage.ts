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
  raw?: string | null;
  /** `broken`: an unreadable value was kept under the backup key. `blocked`: storage is unavailable. */
  problem?: 'broken' | 'blocked';
};

export function loadState(): LoadResult {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const result = readState(raw);
    if (result.status === 'broken') {
      // Never delete an unreadable value: keep it aside for a person to look at.
      window.localStorage.setItem(backupKey, result.raw);
      return { state: result.state, raw, problem: 'broken' };
    }
    return { state: result.state, raw };
  } catch {
    return { state: readState(null).state, problem: 'blocked' };
  }
}

type SaveResult =
  { status: 'saved'; raw: string } | { status: 'changed' | 'blocked' };

export function saveState(
  state: BellState,
  lastRead?: string | null,
): SaveResult {
  try {
    const storage = window.localStorage;
    // Reject stale snapshots, including one left open when Settings cleared the data.
    if (storage.getItem(storageKey) !== (lastRead ?? null))
      return { status: 'changed' };
    const raw = writeState(state);
    storage.setItem(storageKey, raw);
    return { status: 'saved', raw };
  } catch {
    return { status: 'blocked' };
  }
}

/** A ringing checkpoint in another tab does not change the user's settings or drafts. */
export function checkpointChange(previous: string | null, next: string | null) {
  if (!previous || !next) return undefined;
  const before = readState(previous);
  const after = readState(next);
  if (before.status !== 'ok' || after.status !== 'ok') return undefined;
  const checkedAt = after.state.schedule.checkedAt;
  if (checkedAt === undefined) return undefined;
  before.state.schedule.checkedAt = checkedAt;
  return writeState(before.state) === writeState(after.state)
    ? checkedAt
    : undefined;
}

export type StoredBellData = 'present' | 'empty' | 'blocked';

export function storedBellData(): StoredBellData {
  try {
    const storage = window.localStorage;
    return storage.getItem(storageKey) !== null ||
      storage.getItem(backupKey) !== null
      ? 'present'
      : 'empty';
  } catch {
    return 'blocked';
  }
}

export function clearBellData(): boolean {
  try {
    const storage = window.localStorage;
    storage.removeItem(backupKey);
    storage.removeItem(storageKey);
    return storedBellData() === 'empty';
  } catch {
    return false;
  }
}
