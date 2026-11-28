import { convert } from '@winmetta/myanmar-convert';
import { describe, expect, it } from 'vitest';
import { fontFor, resolveInput, switchMethod } from './index.ts';

const zawgyi = (unicode: string) => convert(unicode, 'unicode', 'zawgyi').text;
const auto = (raw: string) => resolveInput(raw, { method: 'auto' });

describe('Auto', () => {
  it.each([['ဗုဒ္ဓ'], ['မြန်မာ'], ['ဓမ္မ သင်္ဃ'], ['ပဉှာ'], ['ကျွန်တော်']])(
    'leaves Unicode alone: %s',
    (text) => {
      const result = auto(text);
      expect(result).toMatchObject({
        unicode: text,
        source: 'unicode',
        fixes: [],
      });
      expect(result.notes).toEqual([]);
    },
  );

  it.each([
    ['မြန်မာ'],
    ['ကျွန်တော်'],
    ['ကောင်း'],
    ['မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် ရှိသော နိုင်ငံ ဖြစ်သည်။'],
  ])('converts Zawgyi typed on a Zawgyi keyboard: %s', (unicode) => {
    const result = auto(zawgyi(unicode));
    expect(result.unicode).toBe(unicode);
    expect(result).toMatchObject({ source: 'zawgyi', evidence: 'marker' });
    expect(result.fixes).toContain('zawgyi-converted');
  });

  it('does not take Pāḷi stacks for Zawgyi, and says it is not sure', () => {
    for (const word of ['ဓမ္မ', 'သတ္တ']) {
      const result = auto(word);
      expect(result).toMatchObject({
        unicode: word,
        source: 'unicode',
        evidence: 'none',
        notes: [{ code: 'unsure' }],
      });
    }
  });

  it('converts a single Zawgyi word the detector alone cannot place', () => {
    expect(auto('ျမန္မာ')).toMatchObject({
      unicode: 'မြန်မာ',
      source: 'zawgyi',
      evidence: 'marker',
    });
  });

  it('trusts the detector on a long Unicode text', () => {
    const text =
      'မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် ရှိသော နိုင်ငံ ဖြစ်သည်။ ပါဠိဘာသာသည် ဗုဒ္ဓဘာသာ၏ ကျမ်းဂန်ဘာသာ ဖြစ်သည်';
    expect(auto(text)).toMatchObject({ source: 'unicode', evidence: 'score' });
  });

  it('passes text without Burmese through, and hints at Win Innwa for Latin', () => {
    expect(auto('hello')).toMatchObject({
      unicode: 'hello',
      notes: [{ code: 'suggest-win-innwa' }],
    });
    expect(auto('123 -')).toMatchObject({ unicode: '123 -', notes: [] });
    expect(auto('')).toMatchObject({ unicode: '', notes: [] });
  });

  it('puts Unicode typing mistakes in order and reports them', () => {
    expect(auto('သာ္တ')).toMatchObject({
      unicode: 'သ္တာ',
      source: 'unicode',
      fixes: ['moved-stack'],
    });
    expect(auto('ဥာဏ်')).toMatchObject({
      unicode: 'ဉာဏ်',
      fixes: ['merged-nya-u'],
    });
  });

  it('skips canonicalizing when asked', () => {
    expect(
      resolveInput('ဥာဏ်', { method: 'auto', canonicalize: false }),
    ).toMatchObject({ unicode: 'ဥာဏ်', fixes: [] });
  });

  it('turns line breaks into spaces unless multiline', () => {
    expect(auto('ဓမ္မ\nသင်္ဃ').unicode).toBe('ဓမ္မ သင်္ဃ');
    expect(
      resolveInput('ဓမ္မ\nသင်္ဃ', { method: 'auto', multiline: true }).unicode,
    ).toBe('ဓမ္မ\nသင်္ဃ');
  });
});

describe('As typed', () => {
  it('changes nothing', () => {
    const raw = 'ေကာင္း ဥာဏ်​';
    expect(resolveInput(raw, { method: 'unicode' })).toEqual({
      unicode: raw,
      source: 'unicode',
      evidence: 'none',
      fixes: [],
      notes: [],
    });
  });
});

describe('Win Innwa', () => {
  it.each([
    ['ဓမ္မ', '"r®'],
    ['သတ္တ', 'owå'],
    ['မြန်မာ', 'jrefrm'],
  ])('reads glyph codes for %s', (unicode, glyphs) => {
    expect(resolveInput(glyphs, { method: 'win-innwa' })).toMatchObject({
      unicode,
      source: 'win-innwa',
      evidence: 'none',
    });
  });

  it('never calls the text Zawgyi, whatever it looks like', () => {
    expect(resolveInput('ျမန္မာ', { method: 'win-innwa' }).source).toBe(
      'win-innwa',
    );
  });
});

describe('switching method', () => {
  it.each(['ဓမ္မ', 'သတ္တ', 'မြန်မာ', 'ကျွန်တော်', 'သင်္ဃ', 'ဉာဏ်'])(
    'Unicode and Win Innwa round trip: %s',
    (unicode) => {
      const toWin = switchMethod(unicode, 'unicode', 'win-innwa');
      expect(toWin.notes).toEqual([]);
      const back = switchMethod(toWin.raw, 'win-innwa', 'unicode');
      expect(back.raw).toBe(unicode);
    },
  );

  it('says what Win Innwa cannot draw, and keeps it', () => {
    const result = switchMethod('သ္သ', 'unicode', 'win-innwa');
    expect(result.raw).toBe('o္သ');
    expect(result.notes).toEqual([{ code: 'unmapped', chars: ['္သ'] }]);
  });

  it('flags Latin letters going into Win Innwa', () => {
    expect(
      switchMethod('ok ဓမ္မ', 'unicode', 'win-innwa').notes,
    ).toContainEqual({ code: 'latin-in-win-innwa' });
  });

  it('Auto to As typed converts what Auto would have read as Zawgyi', () => {
    expect(switchMethod(zawgyi('မြန်မာ'), 'auto', 'unicode').raw).toBe(
      'မြန်မာ',
    );
  });

  it('Unicode and Auto share a form, and the same method is a no-op', () => {
    expect(switchMethod('ဓမ္မ', 'unicode', 'auto')).toEqual({
      raw: 'ဓမ္မ',
      notes: [],
    });
    expect(switchMethod('x', 'win-innwa', 'win-innwa')).toEqual({
      raw: 'x',
      notes: [],
    });
  });
});

describe('fontFor', () => {
  it('follows the method, and Auto follows the last result', () => {
    expect(fontFor('win-innwa')).toBe('win-innwa');
    expect(fontFor('unicode', { source: 'zawgyi' })).toBe('unicode');
    expect(fontFor('auto')).toBe('unicode');
    expect(fontFor('auto', { source: 'zawgyi' })).toBe('zawgyi');
    expect(fontFor('auto', { source: 'unicode' })).toBe('unicode');
  });
});
