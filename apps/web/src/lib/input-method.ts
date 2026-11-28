// The site-wide Burmese typing setting (docs/myanmar-input.md §6): one key, `winmetta.input`, holding
// the method and the Shift+F switch. Missing, invalid or unreadable means Auto with stacking on.
// Kept free of the input package itself (only its types), so the Settings page loads no converter.
import { z } from 'zod';
import type { InputMethod } from '@winmetta/myanmar-input';

export const inputKey = 'winmetta.input';

const schema = z.object({
  method: z.enum(['auto', 'unicode', 'win-innwa']).default('auto'),
  stackKey: z.boolean().default(true),
});
export type InputSetting = {
  method: InputMethod;
  stackKey: boolean;
};
export const defaultInput: InputSetting = { method: 'auto', stackKey: true };

/** Anything that is not a valid saved setting is the default. */
export function parseInputSetting(raw: string | null): InputSetting {
  if (raw === null) return defaultInput;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultInput;
  } catch {
    return defaultInput;
  }
}

// Blocked storage (private mode): the choice lives here for the page view.
let memory: InputSetting | null = null;
let cached: InputSetting = defaultInput;
const listeners = new Set<() => void>();

function load(): InputSetting {
  try {
    const raw = localStorage.getItem(inputKey);
    if (raw !== null) return parseInputSetting(raw);
  } catch {
    /* Storage is optional. */
  }
  return memory ?? defaultInput;
}

/** The current setting; the same object until it changes, so React can compare it. */
export function readInputSetting(): InputSetting {
  const next = load();
  if (next.method !== cached.method || next.stackKey !== cached.stackKey)
    cached = next;
  return cached;
}

const notify = () => listeners.forEach((listener) => listener());

/** Saves part of the setting. Returns false when the browser blocks storage (the page still follows). */
export function writeInputSetting(change: Partial<InputSetting>): boolean {
  const next = { ...load(), ...change };
  memory = next;
  let ok = false;
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(inputKey, raw);
    ok = localStorage.getItem(inputKey) === raw;
  } catch {
    /* Reported by the return value. */
  }
  notify();
  return ok;
}

/** Forgets the setting (Reset on the Settings page). Returns false when storage is blocked. */
export function clearInputSetting(): boolean {
  memory = null;
  let ok = true;
  try {
    localStorage.removeItem(inputKey);
  } catch {
    ok = false;
  }
  notify();
  return ok;
}

/** Calls back on a change here or in another tab. */
export function subscribeInputSetting(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === inputKey || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
