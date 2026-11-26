import { describe, expect, it } from 'vitest';
import {
  applyImport,
  csvHeader,
  maxCsvBytes,
  parseCsv,
  serializeCsv,
  splitRecords,
} from './csv';
import { emptyWeek } from './schedule';

const sample = `day,time,label,sound,rings
Mon,06:00,Morning sitting,winmetta-long,3
Mon,09:00,Dhamma talk,winmetta-short,1
Sun,19:00,Evening chanting,winmetta-long,1
`;
let n = 0;
const id = () => `id${++n}`;

describe('splitRecords', () => {
  it('follows RFC 4180: quotes, commas, doubled quotes, line breaks, CRLF', () => {
    expect(splitRecords('a,"b,c","d ""q"""\r\n"x\ny",z\n')).toEqual([
      ['a', 'b,c', 'd "q"'],
      ['x\ny', 'z'],
    ]);
  });
  it('ignores blank lines', () => {
    expect(splitRecords('a,b\n\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('parseCsv', () => {
  it('reads the sample file', () => {
    const r = parseCsv(sample, 'winmetta-long');
    expect(r).toMatchObject({ ok: true, skipped: [] });
    expect(r.ok && r.bells).toHaveLength(3);
  });
  it('skips bad rows with their row number and reason', () => {
    const r = parseCsv(
      'day,time,label,sound,rings\nFunday,06:00,,,1\nMon,25:00,,,1\nMon,06:00,,,4\nMon,07:00,,,1\nMon,07:00,,,2\nTue,06:00,' +
        'x'.repeat(41) +
        ',,1\n',
      'winmetta-long',
    );
    expect(r.ok && r.skipped).toEqual([
      { row: 2, reason: 'unknown-day' },
      { row: 3, reason: 'invalid-time' },
      { row: 4, reason: 'invalid-rings' },
      { row: 6, reason: 'duplicate' },
      { row: 7, reason: 'label-too-long' },
    ]);
  });
  it('falls back for an unknown or missing sound and defaults rings to 1', () => {
    const r = parseCsv('day,time,sound\nMon,06:00,nope\n', 'winmetta-long');
    expect(r.ok && r.bells[0]).toMatchObject({
      sound: 'winmetta-long',
      soundFallback: true,
      rings: 1,
    });
  });
  it('accepts a byte-order mark and any column order', () => {
    const r = parseCsv('﻿time,day\n06:00,Mon\n', 'winmetta-long');
    expect(r.ok && r.bells).toHaveLength(1);
  });
  it('refuses a missing header, an empty file, a big file and too many bells', () => {
    expect(parseCsv('Mon,06:00\n', 'x')).toEqual({
      ok: false,
      error: 'no-header',
    });
    expect(parseCsv('', 'x')).toEqual({ ok: false, error: 'empty' });
    expect(parseCsv('a'.repeat(maxCsvBytes + 1), 'x')).toEqual({
      ok: false,
      error: 'too-big',
    });
    const rows = Array.from(
      { length: 1440 },
      (_, i) =>
        `Mon,${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    );
    expect(
      parseCsv(`day,time\n${rows.slice(0, 101).join('\n')}\n`, 'x'),
    ).toEqual({ ok: false, error: 'too-many' });
  });
  it('imports nothing from a file with no valid rows', () => {
    const r = parseCsv('day,time\nxx,yy\n', 'x');
    expect(r.ok && r.bells).toEqual([]);
  });
});

describe('row numbers', () => {
  it('are file lines, even with blank lines and multi-line quoted labels', () => {
    const r = parseCsv(
      'day,time,label\n\nMon,06:00,"two\nlines"\nXyz,07:00,a\n\r\nMon,99:00,b\n',
      'winmetta-long',
    );
    expect(r.ok && r.skipped).toEqual([
      { row: 5, reason: 'unknown-day' },
      { row: 7, reason: 'invalid-time' },
    ]);
  });
});

describe('applyImport and round trip', () => {
  it('replace starts empty; add skips a time already set that day', () => {
    const parsed = parseCsv(sample, 'winmetta-long');
    if (!parsed.ok) throw new Error('parse');
    const first = applyImport(emptyWeek(), parsed.bells, 'replace', id);
    expect(first.added).toBe(3);
    const again = applyImport(first.week, parsed.bells, 'add', id);
    expect(again).toMatchObject({ added: 0, skippedExisting: 3 });
    const replaced = applyImport(
      first.week,
      parsed.bells.slice(0, 1),
      'replace',
      id,
    );
    expect(replaced.week.Sun).toEqual([]);
  });
  it('exporting then importing gives the same schedule', () => {
    const parsed = parseCsv(sample, 'winmetta-long');
    if (!parsed.ok) throw new Error('parse');
    const week = applyImport(emptyWeek(), parsed.bells, 'replace', id).week;
    week.Tue = [
      {
        id: 'z',
        time: '05:30',
        label: 'A, "quoted" label',
        sound: 'winmetta-short',
        rings: 2,
      },
    ];
    const text = serializeCsv(week);
    expect(text.startsWith('﻿' + csvHeader.join(','))).toBe(true);
    const back = parseCsv(text, 'winmetta-long');
    if (!back.ok) throw new Error('reparse');
    const again = applyImport(emptyWeek(), back.bells, 'replace', id).week;
    const strip = (w: typeof week) =>
      JSON.stringify(
        Object.values(w).map((l) =>
          l.map((b) => [b.time, b.label, b.sound, b.rings]),
        ),
      );
    expect(strip(again)).toBe(strip(week));
  });
});
