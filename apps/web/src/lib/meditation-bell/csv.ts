// CSV import and export of the weekly schedule (docs/meditation-bell.md §6.2). The file is read in
// the browser and never uploaded.
import { isDay, days, type Day } from './days';
import { parseClock } from './alarm';
import {
  emptyWeek,
  maxLabelLength,
  maxRings,
  minRings,
  type Bell,
  type Week,
} from './schedule';
import { isSoundId } from './sounds';

export const maxCsvBytes = 100 * 1024;
export const maxCsvBells = 700;
export const maxCsvBellsPerDay = 100;
export const csvHeader = ['day', 'time', 'label', 'sound', 'rings'] as const;
export const csvFileName = 'winmetta-bell-schedule.csv';
const BOM = '﻿';

export type SkipReason =
  | 'unknown-day'
  | 'invalid-time'
  | 'invalid-rings'
  | 'label-too-long'
  | 'duplicate';

export interface ParsedBell {
  day: Day;
  time: string;
  label: string;
  /** A known sound id, or the fallback when the file's was missing or unknown. */
  sound: string;
  rings: number;
  soundFallback: boolean;
}

export type CsvResult =
  | {
      ok: true;
      bells: ParsedBell[];
      /** Row numbers count the header as row 1. */
      skipped: { row: number; reason: SkipReason }[];
    }
  | { ok: false; error: 'too-big' | 'too-many' | 'no-header' | 'empty' };

/** RFC 4180 records: quoted fields may hold commas, doubled quotes and line breaks. */
export function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  const endRecord = () => {
    record.push(field);
    field = '';
    if (record.some((cell) => cell.trim() !== '')) records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else field += c;
  }
  endRecord();
  return records;
}

function parseRow(
  cells: Record<string, string>,
  fallbackSound: string,
): ParsedBell | SkipReason {
  const day = (cells.day ?? '').trim();
  if (!isDay(day)) return 'unknown-day';
  const time = (cells.time ?? '').trim();
  if (!parseClock(time)) return 'invalid-time';
  const label = (cells.label ?? '').trim();
  if (label.length > maxLabelLength) return 'label-too-long';
  const ringsText = (cells.rings ?? '').trim();
  const rings = ringsText === '' ? 1 : Number(ringsText);
  if (!Number.isInteger(rings) || rings < minRings || rings > maxRings)
    return 'invalid-rings';
  const sound = (cells.sound ?? '').trim();
  const known = isSoundId(sound);
  return {
    day,
    time,
    label,
    sound: known ? sound : fallbackSound,
    rings,
    soundFallback: !known,
  };
}

/**
 * Parse a CSV file's text. Bad rows are skipped with their row number and reason; a file that is
 * too big, has too many bells or no header imports nothing. `fallbackSound` replaces an unknown or
 * missing sound id (the end bell's sound).
 */
export function parseCsv(text: string, fallbackSound: string): CsvResult {
  if (new TextEncoder().encode(text).length > maxCsvBytes)
    return { ok: false, error: 'too-big' };
  const records = splitRecords(text.startsWith(BOM) ? text.slice(1) : text);
  const header = records.shift()?.map((name) => name.trim().toLowerCase());
  if (!header) return { ok: false, error: 'empty' };
  if (!header.includes('day') || !header.includes('time'))
    return { ok: false, error: 'no-header' };

  const bells: ParsedBell[] = [];
  const skipped: { row: number; reason: SkipReason }[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const row = index + 2;
    const cells = Object.fromEntries(
      header.map((name, i) => [name, record[i] ?? '']),
    );
    const parsed = parseRow(cells, fallbackSound);
    if (typeof parsed === 'string')
      return skipped.push({ row, reason: parsed });
    const key = `${parsed.day} ${parsed.time}`;
    if (seen.has(key)) return skipped.push({ row, reason: 'duplicate' });
    seen.add(key);
    bells.push(parsed);
  });

  const perDay = (day: Day) => bells.filter((b) => b.day === day).length;
  if (
    bells.length > maxCsvBells ||
    days.some((d) => perDay(d) > maxCsvBellsPerDay)
  )
    return { ok: false, error: 'too-many' };
  return { ok: true, bells, skipped };
}

const sortedByTime = (list: Bell[]) =>
  list.sort((a, b) => a.time.localeCompare(b.time));

/**
 * Apply parsed bells to a week. `replace` starts from an empty week; `add` keeps the current bells
 * and skips a time that already has a bell on that day (returned as `skippedExisting`). `newId`
 * makes the id of each new bell; bells with the same day, time-independent content are separate.
 */
export function applyImport(
  current: Week,
  parsed: readonly ParsedBell[],
  mode: 'replace' | 'add',
  newId: () => string,
): { week: Week; added: number; skippedExisting: number } {
  const week: Week = mode === 'replace' ? emptyWeek() : { ...current };
  let added = 0;
  let skippedExisting = 0;
  for (const bell of parsed) {
    if (week[bell.day].some((b) => b.time === bell.time)) {
      skippedExisting++;
      continue;
    }
    week[bell.day] = sortedByTime([
      ...week[bell.day],
      {
        id: newId(),
        time: bell.time,
        label: bell.label,
        sound: bell.sound,
        rings: bell.rings,
      },
    ]);
    added++;
  }
  return { week, added, skippedExisting };
}

const quote = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** The schedule as CSV, UTF-8 with a byte-order mark so Excel shows Burmese labels correctly. */
export function serializeCsv(week: Week): string {
  const lines: string[] = [csvHeader.join(',')];
  for (const day of days) {
    for (const bell of week[day]) {
      lines.push(
        [
          day,
          bell.time,
          quote(bell.label),
          bell.sound,
          String(bell.rings),
        ].join(','),
      );
    }
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
