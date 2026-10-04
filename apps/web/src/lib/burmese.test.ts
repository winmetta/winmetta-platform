import { describe, expect, it } from 'vitest';
import { burmeseSyllables, splitScripts } from './burmese';
describe('burmeseSyllables', () => {
  it('segments common words into syllables', () => {
    expect(burmeseSyllables('မြန်မာစာ')).toEqual(['မြန်', 'မာ', 'စာ']);
    expect(burmeseSyllables('ဝိနည်း')).toEqual(['ဝိ', 'နည်း']);
    expect(burmeseSyllables('ကျမ်း')).toEqual(['ကျမ်း']);
  });
  it('keeps stacked consonants and kinzi inside one syllable', () => {
    expect(burmeseSyllables('ဓမ္မ')).toEqual(['ဓမ္မ']);
    expect(burmeseSyllables('သင်္ဂြိုဟ်')).toEqual(['သင်္ဂြိုဟ်']);
  });
  it('starts new syllables at independent vowels and digits', () => {
    expect(burmeseSyllables('ဥပဒေ')).toEqual(['ဥ', 'ပ', 'ဒေ']);
    expect(burmeseSyllables('၁၂')).toEqual(['၁', '၂']);
  });
  it('rejoins to the original text and handles empty input', () => {
    const text = 'ပါဠိတော်နိဿယ';
    expect(burmeseSyllables(text).join('')).toBe(text);
    expect(burmeseSyllables('')).toEqual([]);
  });
  it('does not match a syllable start inside another syllable', () => {
    expect(burmeseSyllables('ကျ')).toEqual(['ကျ']);
  });
});
describe('splitScripts', () => {
  it('separates Burmese runs from Latin text and spaces', () => {
    expect(splitScripts('Pali ပါဠိ 2')).toEqual([
      { script: 'other', text: 'Pali ' },
      { script: 'my', text: 'ပါဠိ' },
      { script: 'other', text: ' 2' },
    ]);
  });
});
