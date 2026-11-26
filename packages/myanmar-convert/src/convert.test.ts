import { describe, expect, it } from 'vitest';
import { convert, detect, ENCODINGS, type Encoding } from './convert.ts';

// The same words in each encoding.
const SAMPLES: Record<Encoding, string>[] = [
  { unicode: 'မင်္ဂလာပါ', zawgyi: 'မဂၤလာပါ', 'win-innwa': 'r*Fvmyg' },
  { unicode: 'မြန်မာ', zawgyi: 'ျမန္မာ', 'win-innwa': 'jrefrm' },
  { unicode: 'နှင့်', zawgyi: 'ႏွင့္', 'win-innwa': 'ESifh' },
  { unicode: 'ကြီး', zawgyi: 'ႀကီး', 'win-innwa': 'BuD;' },
  { unicode: 'ဗုဒ္ဓ', zawgyi: 'ဗုဒၶ', 'win-innwa': "Ak'¨" },
];

describe('convert', () => {
  for (const sample of SAMPLES)
    for (const from of ENCODINGS)
      for (const to of ENCODINGS)
        it(`${sample.unicode}: ${from} -> ${to}`, () => {
          expect(convert(sample[from], from, to).text).toBe(sample[to]);
        });

  it('reads Zawgyi with the dot typed before the asat too', () => {
    expect(convert('ႏွင့္', 'zawgyi', 'unicode').text).toBe('နှင့်');
  });

  it('returns the text unchanged for the same encoding', () => {
    expect(convert('ျမန္မာ', 'zawgyi', 'zawgyi')).toEqual({
      text: 'ျမန္မာ',
      notes: [],
    });
  });

  it('keeps lines, blank lines and indentation from Win Innwa', () => {
    expect(convert('  jrefrm\n\npm ', 'win-innwa', 'unicode').text).toBe(
      '  မြန်မာ\n\nစာ ',
    );
  });

  it('notes letters with no Win Innwa glyph', () => {
    expect(convert('သ္သ', 'unicode', 'win-innwa').notes).toEqual([
      { code: 'unmapped', chars: ['္သ'] },
    ]);
  });

  it('notes Latin text in Win Innwa output', () => {
    expect(convert('ဓမ္မ Dhamma', 'unicode', 'win-innwa').notes).toEqual([
      { code: 'latin-in-win-innwa' },
    ]);
  });

  it('notes Unicode text given as Zawgyi', () => {
    expect(convert('မြန်မာစာ', 'zawgyi', 'unicode').notes).toEqual([
      { code: 'source-looks-unicode' },
    ]);
  });

  it('notes Zawgyi text given as Unicode', () => {
    expect(convert('ေမာင္', 'unicode', 'win-innwa').notes).toContainEqual({
      code: 'source-looks-zawgyi',
    });
  });
});

describe('detect', () => {
  it.each([
    ['ျမန္မာစာ ေလ့လာျခင္း', 'zawgyi'],
    ['မြန်မာစာ လေ့လာခြင်း', 'unicode'],
    ['ဓမ္မ', 'unsure'], // Pāḷi stacks score as Zawgyi, but no Zawgyi-only pattern: never auto-converted
    ['Dhamma', 'no-myanmar'],
    ['jrefrm', 'no-myanmar'], // Win Innwa is plain Latin letters and cannot be detected
  ] as const)('%s -> %s', (text, expected) => {
    expect(detect(text)).toBe(expected);
  });
});
