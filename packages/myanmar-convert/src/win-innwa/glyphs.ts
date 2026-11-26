// Unicode -> Win Innwa glyph table.
//
// Win Innwa (WinMyanmar Systems; Win Researcher, Win Kalaw and the rest of the family share it) draws
// Burmese glyphs on the ASCII and Windows-1252 code points of the keys that type them. The code points
// below follow the Win -> Unicode table in knayi-myscript 2.10.0 (library/win.js, MIT,
// Copyright (c) greenlikeorange), read in reverse. Which variant of a glyph to use (narrow or wide medial
// ra, short na, tall u, dot positions) follows the rules of trhura/python-myanmar (myanmar/converter.py,
// MIT, Copyright (c) 2018 Thura Hlaing) where they agree with common Win Innwa text, such as "ESifh"
// for နှင့် and "aeY" for နေ့. See NOTICE.

/** Consonants and independent letters that stand as the base of a syllable. */
export const BASE: Readonly<Record<string, string>> = {
  က: 'u',
  ခ: 'c',
  ဂ: '*',
  ဃ: 'C',
  င: 'i',
  စ: 'p',
  ဆ: 'q',
  ဇ: 'Z',
  ဈ: 'ps', // ဈ: Win has no glyph; typed as စ with medial ya
  ဉ: 'Ú',
  ည: 'n',
  ဋ: '#',
  ဌ: 'X',
  ဍ: '!',
  ဎ: '¡',
  ဏ: 'P',
  တ: 'w',
  ထ: 'x',
  ဒ: "'",
  ဓ: '"',
  န: 'e',
  ပ: 'y',
  ဖ: 'z',
  ဗ: 'A',
  ဘ: 'b',
  မ: 'r',
  ယ: ',',
  ရ: '&',
  လ: 'v',
  ဝ: '0', // ဝ: Win has no glyph; typed as zero
  သ: 'o',
  ဟ: '[',
  ဠ: 'V',
  အ: 't',
  ဣ: '£',
  ဤ: 'þ',
  ဥ: 'O',
  ဦ: 'OD', // ဦ: typed as ဥ with ii
  ဧ: '{',
  ဩ: 'Mo', // ဩ: typed as သ with medial ra
  ဪ: 'aMomf',
  ဿ: 'ó',
  '၌': 'ü',
  '၍': 'í',
  '၎': '¤',
  '၏': '\\',
};

/** Short forms used when a mark sits below the letter. */
export const SHORT_BASE: Readonly<Record<string, string>> = {
  န: 'E',
  ရ: '½',
  ည: 'ñ',
  ဉ: 'Í',
};

/** Digits and Burmese punctuation, which take no marks. */
export const STANDALONE: Readonly<Record<string, string>> = {
  '၀': '0',
  '၁': '1',
  '၂': '2',
  '၃': '3',
  '၄': '4',
  '၅': '5',
  '၆': '6',
  '၇': '7',
  '၈': '8',
  '၉': '9',
  '၊': '?',
  '။': '/',
};

/** A consonant stacked under the base (after U+1039 virama). */
export const STACK: Readonly<Record<string, string>> = {
  က: 'ú',
  ခ: '©',
  ဂ: '¾',
  ဃ: '¢',
  စ: 'ö',
  ဆ: 'ä',
  ဇ: 'Æ',
  ဈ: 'Ñ',
  ဋ: '³',
  ဌ: '²',
  ဏ: 'Ö',
  တ: 'å',
  ထ: '¬',
  ဒ: '´',
  ဓ: '¨',
  န: 'é',
  ပ: 'Ü',
  ဖ: 'æ',
  ဗ: 'Á',
  ဘ: 'Ç',
  မ: '®',
  လ: '’',
};

/** Base and stacked consonant drawn as one glyph. Keys are the two consonants. */
export const LIGATURE: Readonly<Record<string, string>> = {
  ဍဍ: '×', // ဍ္ဍ
  ဍဎ: '¹', // ဍ္ဎ
  ဏဍ: '@', // ဏ္ဍ
  ဋဌ: '|', // ဋ္ဌ
  ဋဋ: '¥', // ဋ္ဋ
};

/** Consonants wide enough to take the wide medial ra. */
export const WIDE = new Set([
  'က', // က
  'ဃ', // ဃ
  'စ', // စ
  'ဆ', // ဆ
  'ည', // ည
  'ဏ', // ဏ
  'တ', // တ
  'ထ', // ထ
  'ဘ', // ဘ
  'ယ', // ယ
  'လ', // လ
  'သ', // သ
  'ဟ', // ဟ
  'အ', // အ
  'ဿ', // ဿ
]);

export const MEDIAL_RA = {
  narrow: 'j',
  wide: 'M',
  narrowUpper: 'N', // cut for a mark above
  wideUpper: 'B',
  narrowLower: '`', // cut for a mark below
  wideLower: '~',
  narrowWa: '>', // with medial wa
  wideWa: '<',
} as const;

export const MARK = {
  e: 'a',
  i: 'd',
  ii: 'D',
  iAnusvara: 'ð',
  u: 'k',
  uTall: 'K',
  uu: 'l',
  uuTall: 'L',
  ai: 'J',
  anusvara: 'H',
  aa: 'm',
  tallAa: 'g',
  tallAaAsat: ':',
  asat: 'f',
  dot: 'h',
  dotRight: 'Y',
  visarga: ';',
  kinzi: 'F',
  kinziI: 'Ø',
  kinziIi: 'Ð',
  kinziAnusvara: 'ø',
  ya: 's',
  yaLong: 'ß',
  yaWa: 'R',
  yaHa: 'Q',
  yaWaHa: 'W',
  wa: 'G',
  waHa: 'T',
  ha: 'S',
  haU: 'I',
  haUu: 'ª',
  nyaAa: 'Ó', // ဉာ
} as const;
