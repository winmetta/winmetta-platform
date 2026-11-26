// What is kept in the browser (docs/meditation-bell.md §6.1): one `localStorage` key with a
// versioned JSON object, validated with Zod on read.
import { z } from 'zod';
import { maxLabelLength, maxRings, minRings, emptyWeek } from './schedule';
import { defaultEndRings, defaultEndSound, defaultStartSound } from './sounds';
import { maxMinutes } from './timer';

export const storageKey = 'winmetta.meditationBell';
/** An unreadable value is moved here, not deleted. */
export const backupKey = 'winmetta.meditationBell.backup';
export const stateVersion = 1;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const rings = z.number().int().min(minRings).max(maxRings);

const bellSchema = z.object({
  id: z.string().min(1).max(64),
  time,
  label: z.string().max(maxLabelLength),
  sound: z.string().min(1).max(64),
  rings,
});

const weekSchema = z.object({
  Mon: z.array(bellSchema),
  Tue: z.array(bellSchema),
  Wed: z.array(bellSchema),
  Thu: z.array(bellSchema),
  Fri: z.array(bellSchema),
  Sat: z.array(bellSchema),
  Sun: z.array(bellSchema),
});

const timerSchema = z.object({
  mode: z.enum(['countdown', 'alarm']),
  status: z.enum(['idle', 'running', 'paused', 'finished', 'missed']),
  lengthMs: z
    .number()
    .int()
    .min(0)
    .max(maxMinutes * 60_000),
  endAt: z.number().nullable(),
  remainingMs: z.number().min(0).nullable(),
});

export const stateSchema = z.object({
  version: z.literal(stateVersion),
  startBell: z.object({ sound: z.string().min(1).max(64) }),
  endBell: z.object({ sound: z.string().min(1).max(64), rings }),
  schedule: z.object({
    on: z.boolean(),
    week: weekSchema,
    checkedAt: z.number().int().nonnegative().optional(),
  }),
  timer: timerSchema.nullable(),
});
export type BellState = z.infer<typeof stateSchema>;

export const defaultState = (): BellState => ({
  version: stateVersion,
  // 'off' is also valid for the start bell (§3.3).
  startBell: { sound: defaultStartSound },
  endBell: { sound: defaultEndSound, rings: defaultEndRings },
  schedule: { on: false, week: emptyWeek() },
  timer: null,
});

export type ReadResult =
  /** Nothing stored yet: start from the defaults. */
  | { status: 'empty'; state: BellState }
  | { status: 'ok'; state: BellState }
  /** Unreadable or from a newer version: start empty, keep `raw` under the backup key, tell the user. */
  | { status: 'broken'; state: BellState; raw: string };

/** Parse a stored value without throwing. The caller backs up `raw` on `broken` (never deletes it). */
export function readState(raw: string | null): ReadResult {
  if (raw === null) return { status: 'empty', state: defaultState() };
  try {
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { status: 'ok', state: parsed.data };
  } catch {
    /* Not JSON: handled below. */
  }
  return { status: 'broken', state: defaultState(), raw };
}

export const writeState = (state: BellState): string => JSON.stringify(state);
