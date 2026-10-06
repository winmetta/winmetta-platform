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
  it('converts only the part that is Zawgyi, not a Unicode title with a Zawgyi note', () => {
    // Reported in PR review: the title has no Zawgyi marker of its own.
    const byText: ZawgyiDetector = {
      getZawgyiProbability: (text) => (text.includes('ေတာ္') ? 1 : 0),
    };
    const fix = fixZawgyiTitle(
      { title: 'ဥပါသေကာပဒေသကထာ', titleNote: '၀ိသုဒၶါ႐ုံဆရာေတာ္' },
      byText,
      converter,
    );
    expect(fix.verdict).toBe('converted');
    expect(fix.title).toBe('ဥပါသေကာပဒေသကထာ');
    expect(fix.titleNote).toBe('converted:၀ိသုဒၶါ႐ုံဆရာေတာ္');
  });
  it('converts only the title when the note is Unicode', () => {
    const byText: ZawgyiDetector = {
      getZawgyiProbability: (text) => (text.includes('ေတာ္') ? 1 : 0),
    };
    const fix = fixZawgyiTitle(
      { title: 'ရခိုင္ မဟာရာဇဝင္ေတာ္ႀကီး', titleNote: 'ဆရာတော်' },
      byText,
      converter,
    );
    expect(fix.title).toBe('converted:ရခိုင္ မဟာရာဇဝင္ေတာ္ႀကီး');
    expect(fix.titleNote).toBe('ဆရာတော်');
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
