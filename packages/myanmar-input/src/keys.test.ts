import { unicodeToWinInnwa } from '@winmetta/myanmar-convert';
import { describe, expect, it } from 'vitest';
import {
  createKeyEngine,
  keyGroups,
  type KeyAction,
  type KeyEvent,
} from './keys.ts';

const key = (k: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({
  key: k,
  shiftKey: k.length === 1 && k !== k.toLowerCase(),
  ...extra,
});
const SHIFT_F = key('F', { shiftKey: true });
const insert = (text: string, replace = 0): KeyAction => ({
  type: 'insert',
  text,
  replace,
});

describe('stacking: Shift+F then the consonant key', () => {
  // Every row: the key, and the Unicode consonant it stacks. The expected glyph is whatever the
  // converter writes, so this table and the converter cannot drift apart.
  it.each(
    keyGroups('win-innwa')
      .find((g) => g.id === 'stacked')!
      .keys.map((k) => [k.unicode, k.winInnwa]),
  )('stack %s gives %s', (unicode, glyph) => {
    expect(unicodeToWinInnwa(`က${unicode}`).text).toBe(`u${glyph}`);
  });

  it('types the stacked glyph and replaces nothing', () => {
    const engine = createKeyEngine('win-innwa');
    expect(engine.handle(SHIFT_F)).toEqual({ type: 'arm' });
    expect(engine.armed).toBe(true);
    expect(engine.handle(key('r'), 'r')).toEqual(insert('®'));
    expect(engine.armed).toBe(false);
  });

  it('ဓမ္မ is r then Shift+F r', () => {
    const engine = createKeyEngine('win-innwa');
    expect(engine.handle(key('"'))).toEqual({ type: 'pass' });
    expect(engine.handle(key('r'), '"')).toEqual({ type: 'pass' });
    engine.handle(SHIFT_F, '"r');
    expect(engine.handle(key('r'), '"r')).toEqual(insert('®'));
    expect(unicodeToWinInnwa('ဓမ္မ').text).toBe('"r®');
  });

  it('waits through a bare Shift press', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F);
    expect(engine.handle({ key: 'Shift' })).toEqual({ type: 'pass' });
    expect(engine.armed).toBe(true);
    expect(engine.handle(key('Q'), '')).toEqual(insert('Ñ'));
  });
});

describe('ligatures', () => {
  it.each([
    ['#', '#', '¥', 'ဋ္ဋ'],
    ['#', 'X', '|', 'ဋ္ဌ'],
    ['!', '!', '×', 'ဍ္ဍ'],
    ['!', 'B', '¹', 'ဍ္ဎ'],
    ['P', '!', '@', 'ဏ္ဍ'],
  ])('%s then Shift+F %s gives %s', (before, k, glyph, unicode) => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F, before);
    expect(engine.handle(key(k), before)).toEqual(insert(glyph, 1));
    expect(unicodeToWinInnwa(unicode).text).toBe(glyph);
  });

  it('after another letter the key is a plain stack', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F, 'u');
    expect(engine.handle(key('#'), 'u')).toEqual(insert('³'));
  });
});

describe('kinzi, cancel and off', () => {
  it('ff replaces the asat with the kinzi glyph', () => {
    const engine = createKeyEngine('win-innwa');
    expect(engine.handle(key('f'), 'i')).toEqual({ type: 'pass' });
    expect(engine.handle(key('f'), 'if')).toEqual(insert('F', 1));
  });

  it('a key not in the table cancels the dead key and types normally', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F);
    expect(engine.handle(key('1'))).toEqual({ type: 'cancel' });
    expect(engine.armed).toBe(false);
  });

  it('a second Shift+F cancels, so F is typed', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F);
    expect(engine.handle(SHIFT_F)).toEqual({ type: 'cancel' });
  });

  it('a shortcut cancels the dead key', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F);
    expect(engine.handle(key('v', { metaKey: true }))).toEqual({
      type: 'cancel',
    });
    expect(engine.handle(key('v', { metaKey: true }))).toEqual({
      type: 'pass',
    });
  });

  it('reset drops a pending dead key', () => {
    const engine = createKeyEngine('win-innwa');
    engine.handle(SHIFT_F);
    engine.reset();
    expect(engine.handle(key('r'))).toEqual({ type: 'pass' });
  });

  it('does nothing when stacking is off or in other methods', () => {
    for (const engine of [
      createKeyEngine('win-innwa', { stackKey: false }),
      createKeyEngine('auto'),
      createKeyEngine('unicode'),
    ]) {
      expect(engine.handle(SHIFT_F)).toEqual({ type: 'pass' });
      expect(engine.handle(key('f'), 'f')).toEqual({ type: 'pass' });
    }
  });
});

describe('keyGroups', () => {
  it('inserts Unicode in Auto and As typed, glyph codes in Win Innwa', () => {
    const stacked = (m: 'auto' | 'unicode' | 'win-innwa') =>
      keyGroups(m)[0]!.keys[0]!;
    expect(stacked('auto').insert).toBe('္က');
    expect(stacked('unicode').insert).toBe('္က');
    expect(stacked('win-innwa').insert).toBe('ú');
  });

  it('every tray key matches the converter', () => {
    for (const group of keyGroups('win-innwa'))
      for (const k of group.keys) {
        if (k.kind === 'stack' || k.kind === 'kinzi') continue; // need a base
        expect(unicodeToWinInnwa(k.unicode).text).toBe(k.winInnwa);
      }
  });

  it('kinzi is the F glyph before a consonant', () => {
    expect(unicodeToWinInnwa('မင်္ဂ').text).toContain('F');
  });

  it('counts kinds the analytics event allows', () => {
    const kinds = new Set(
      keyGroups('auto').flatMap((g) => g.keys.map((k) => k.kind)),
    );
    expect([...kinds].sort()).toEqual(['kinzi', 'letter', 'ligature', 'stack']);
  });
});
