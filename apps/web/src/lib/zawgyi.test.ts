import { describe, expect, it } from 'vitest';
import {
  fixZawgyiTitle,
  hasZawgyiMarker,
  type ZawgyiConverter,
  type ZawgyiDetector,
} from './zawgyi';
const detector = (probability: number): ZawgyiDetector => ({
  getZawgyiProbability: () => probability,
});
const converter: ZawgyiConverter = {
  zawgyiToUnicode: (text) => `converted:${text}`,
};
describe('hasZawgyiMarker', () => {
  it.each([
    'ကုသပ်ဳိ႕', // glyph-only code points
    'ေသာတတၳကီ', // ေ before its consonant
    'ရခိုင္ မဟာရာဇဝင္ေတာ္ႀကီး', // virama used as asat
    '၀၀၃။ အေျခခံပါဠိသဒၵ္',
  ])('flags Zawgyi: %s', (text) => {
    expect(hasZawgyiMarker(text)).toBe(true);
  });
  it.each([
    'မြန်မာစာ',
    'ဓမ္မပဒ', // stacked consonants are valid Unicode
    'ဝိနိစ္ဆယ သင်္ဂဟ',
    'ပေမူများ',
    'Pali Grammar',
  ])('does not flag valid Unicode: %s', (text) => {
    expect(hasZawgyiMarker(text)).toBe(false);
  });
});
describe('fixZawgyiTitle', () => {
  it('converts title and note when marker and detector agree', () => {
    const fix = fixZawgyiTitle(
      { title: 'ေသာတတၳကီ', titleNote: 'စူဠဗုဒၶေဃာသ' },
      detector(1),
      converter,
    );
    expect(fix).toEqual({
      verdict: 'converted',
      probability: 1,
      title: 'converted:ေသာတတၳကီ',
      titleNote: 'converted:စူဠဗုဒၶေဃာသ',
    });
  });
  it('leaves Pāḷi that only trips the detector unchanged', () => {
    const fix = fixZawgyiTitle({ title: 'ဓမ္မပဒ' }, detector(0.99), converter);
    expect(fix).toEqual({
      verdict: 'ambiguous',
      probability: 0.99,
      title: 'ဓမ္မပဒ',
    });
  });
  it('leaves marker-only text unchanged when the detector disagrees', () => {
    const fix = fixZawgyiTitle({ title: 'မောနေေယျ' }, detector(0), converter);
    expect(fix.verdict).toBe('suspicious');
    expect(fix.title).toBe('မောနေေယျ');
  });
  it('ignores text without Burmese characters', () => {
    const fix = fixZawgyiTitle(
      { title: 'Pali Grammar' },
      detector(1),
      converter,
    );
    expect(fix.verdict).toBe('unicode');
  });
});
