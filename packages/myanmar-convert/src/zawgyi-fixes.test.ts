import tools from 'myanmar-tools';
import { describe, expect, it } from 'vitest';
import { protectLoneFour, unicodeToZawgyiStackedE } from './zawgyi-fixes.ts';

const converter = new tools.ZawgyiConverter();
const u2z = (text: string) => converter.unicodeToZawgyi(text);
const z2u = (text: string) => converter.zawgyiToUnicode(text);

describe('unicodeToZawgyiStackedE', () => {
  it('shows the myanmar-tools bug it works around', () => {
    // ေ is written after the stacked ဒ, so converting back attaches it to သ.
    expect(z2u(u2z('နိဒ္ဒေသ'))).toBe('နိဒ္ဒသေ');
  });

  it.each([
    'နိဒ္ဒေသ',
    'အစိန္တေယျ',
    'ဗုဒ္ဓဃောသ',
    'ပါတိမောက္ခမေဒိနီ',
    'ဓမ္မစေတီ',
  ])('round-trips %s', (unicode) => {
    expect(z2u(unicodeToZawgyiStackedE(unicode, u2z))).toBe(unicode);
  });

  it('puts ေ before the syllable in the Zawgyi output', () => {
    expect(unicodeToZawgyiStackedE('ဒ္ဒေ', u2z)).toBe('ေဒၵ');
  });

  it('leaves ေ that belongs to the next letter in place', () => {
    expect(unicodeToZawgyiStackedE('ဓမ္မစေ', u2z)).toBe(u2z('ဓမ္မစေ'));
  });
});

describe('protectLoneFour', () => {
  it('shows the myanmar-tools bug it works around', () => {
    expect(z2u('အပိုင္း ၄')).toBe('အပိုင်း ၎');
  });

  it.each([
    ['အပိုင္း ၄', 'အပိုင်း ၄'],
    ['၄ ခု', '၄ ခု'],
    ['၄၅ ႏွစ္', '၄၅ နှစ်'],
    ['၄င္း', '၎င်း'], // Zawgyi typists' ၎င်း still converts
  ])('%s -> %s', (zawgyi, unicode) => {
    expect(protectLoneFour(zawgyi, z2u)).toBe(unicode);
  });
});
