import { describe, expect, it } from 'vitest';
import { unicodeToWinInnwa } from './from-unicode.ts';
import { winInnwaToUnicode } from './to-unicode.ts';

const win = (text: string) => unicodeToWinInnwa(text).text;

describe('unicodeToWinInnwa', () => {
  // Spellings as Win Innwa users type them, checked against long-standing Win Innwa text.
  it.each([
    ['မင်္ဂလာပါ', 'r*Fvmyg'], // kinzi after its consonant
    ['မြန်မာ', 'jrefrm'], // narrow medial ra before the consonant
    ['နှင့်', 'ESifh'], // short na under medial ha; asat then dot
    ['နေ့', 'aeY'], // e first; the dot moves right after na
    ['ဗုဒ္ဓ', "Ak'¨"], // stacked consonant after its base
    ['ပြုလုပ်', 'jyKvkyf'], // tall u under medial ra
    ['ကြီး', 'BuD;'], // wide medial ra, cut for ii
    ['ပြီး', 'NyD;'], // narrow medial ra, cut for ii
    ['ကြောင့်', 'aMumifh'], // e, wide medial ra, consonant
    ['ရှိ', '&Sd'], // ra keeps its height with medial ha
  ])('%s -> %s', (unicode, expected) => {
    expect(win(unicode)).toBe(expected);
  });

  it('uses short letters for a mark below', () => {
    expect(win('ရုပ်')).toBe('½kyf');
    expect(win('ညွှန်')).toBe('ñTef');
  });

  it('writes the one-glyph forms', () => {
    expect(win('ဉာဏ်')).toBe('ÓPf'); // ဉာ
    expect(win('ဏ္ဍ')).toBe('@'); // two consonants in one glyph
    expect(win('အင်္ဂလိပ်')).toBe('t*Fvdyf');
    expect(win('သင်္ချိုင်း')).toBe('ocØsKif;'); // kinzi and i in one glyph
    expect(win('သင်္ဃံ')).toBe('oCø'); // kinzi and anusvara in one glyph
    expect(win('အိံ')).toBe('tð'); // i and anusvara in one glyph
  });

  it('writes letters Win Innwa types as sequences', () => {
    expect(win('ဈေး')).toBe('aps;');
    expect(win('ဦး')).toBe('OD;');
    expect(win('ဩ')).toBe('Mo');
  });

  it('writes digits and punctuation', () => {
    expect(win('၁၂၃။ ပထမ၊')).toBe('123/ yxr?');
  });

  it('keeps letters with no Win Innwa glyph as Unicode and reports them', () => {
    const result = unicodeToWinInnwa('ဗြဟ္မ သ္သ');
    expect(result.text).toBe('jA[® o္သ'); // ဟ္မ has a glyph; a stacked သ does not
    expect(result.unmapped).toEqual(['္သ']);
  });

  it('reports Latin text, which a Win Innwa font draws as Burmese', () => {
    expect(unicodeToWinInnwa('ဓမ္မ Dhamma').hasLatin).toBe(true);
    expect(unicodeToWinInnwa('ဓမ္မ ၁၂').hasLatin).toBe(false);
    expect(unicodeToWinInnwa('ဆရာ’s').hasLatin).toBe(true); // ’ is a stacked la in the font
    expect(unicodeToWinInnwa('စာ…').hasLatin).toBe(true);
  });

  it('keeps spaces and line breaks', () => {
    expect(win('  မြန်မာ\n\nစာ ')).toBe('  jrefrm\n\npm ');
  });
});

// Words chosen for Pāḷi stacks, kinzi, medials and vowel combinations.
const WORDS = [
  'ဓမ္မ',
  'သင်္ဃ',
  'ပတ္တိ',
  'အဘိဓမ္မာ',
  'ဝိနည်း',
  'သုတ္တန်',
  'နိဗ္ဗာန်',
  'သမ္မာသမ္ဗုဒ္ဓ',
  'ဝိပဿနာ',
  'သမထ',
  'မေတ္တာ',
  'ကရုဏာ',
  'မုဒိတာ',
  'ဥပေက္ခာ',
  'ပါဠိ',
  'တိပိဋက',
  'အဋ္ဌကထာ',
  'ဋီကာ',
  'ဗုဒ္ဓံ သရဏံ ဂစ္ဆာမိ',
  'ကျွန်ုပ်',
  'ချစ်ခြင်း',
  'ကြောင်း',
  'မြှင့်', // medial ra with medial ha
  'ကြွ', // medial ra with medial wa
  'ရှုံး', // ha with u, then anusvara
  'ချုပ်',
  'ပွဲ',
  'ပြောင်းလဲ',
  'ရှင်းလင်း',
  'လှူဒါန်း',
  'နှုတ်',
  'သွား',
  'ဆွမ်း',
  'ကျောင်း',
  'ဆရာတော်',
  'ဦးဇင်း',
  'ဒါန သီလ ဘာဝနာ',
  'ဣန္ဒြေ',
  'ဤ',
  'ဧက',
  '၎င်း',
  '၏',
  '၌',
  '၍',
  'ဿ',
  'ဠ',
];

describe('Unicode -> Win Innwa -> Unicode', () => {
  it.each(WORDS)('round-trips %s', (word) => {
    const { text, unmapped } = unicodeToWinInnwa(word);
    expect(unmapped).toEqual([]);
    expect(winInnwaToUnicode(text)).toBe(word);
  });
});
