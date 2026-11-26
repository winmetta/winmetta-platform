// Fixes around myanmar-tools 1.1.3's converter. Each one has a test in zawgyi-fixes.test.ts with the
// input that goes wrong without it. Code points are escaped: most are combining marks, which do not
// show on their own.

// A Unicode syllable with a stacked consonant and ေ (U+1031): consonant, virama (U+1039), consonant,
// medials (U+103B-U+103E), ေ, then vowels and marks.
const STACKED_E_SYLLABLE =
  /([\u1000-\u1021]\u1039[\u1000-\u1021][\u103B-\u103E]*\u1031[\u102B-\u1030\u1032\u1036-\u103A]*)/;
// The same syllable in the converter's Zawgyi output: a consonant (or one of Zawgyi's short forms of
// nya, na and ra: U+106A, U+106B, U+108F, U+1090), the Zawgyi stacked-consonant glyphs, then ေ.
const E_AFTER_STACK =
  // Unicode classes these Zawgyi glyph code points as combining marks; each is meant as one character.
  // eslint-disable-next-line no-misleading-character-class -- see above
  /^([\u1000-\u1021\u106A\u106B\u108F\u1090])([\u1060-\u1063\u1065-\u1069\u106C\u106D\u1070-\u107C\u1085\u1093\u1096]+)\u1031/;

/**
 * Unicode -> Zawgyi writes ေ after a stacked consonant (ဒၵေ for ဒ္ဒေ) instead of before the syllable
 * (ေဒၵ). A Zawgyi font then draws the ေ on the next letter, and converting back moves it there:
 * နိဒ္ဒေသ came back as နိဒ္ဒသေ. In whole-text output this cannot be repaired, because correct
 * Zawgyi looks the same when the ေ belongs to the next letter (ဓမ္မစေ is ဓမၼေစ). So each such
 * syllable is converted on its own, where the ေ is known to be its own, and moved to its front.
 */
export function unicodeToZawgyiStackedE(
  unicode: string,
  convert: (text: string) => string,
): string {
  if (!unicode.includes('\u1039')) return convert(unicode);
  return (
    unicode
      .split(STACKED_E_SYLLABLE)
      // split with a capture group puts the matched syllables at odd indexes.
      .map((part, i) =>
        i % 2 === 1
          ? convert(part).replace(E_AFTER_STACK, '\u1031$1$2')
          : convert(part),
      )
      .join('')
  );
}

// ၄ (digit four, U+1044) alone: not part of a number (U+1040-U+1049) and not followed by င (U+1004),
// which is how Zawgyi typists write ၎င်း.
const LONE_FOUR = /(?<![\u1040-\u1049])\u1044(?![\u1040-\u1049]|\u1004)/g;
const FOUR_PLACEHOLDER = '\uE044'; // private use, never in real text

/**
 * Zawgyi -> Unicode reads a lone ၄ before a space as ၎ (lagaung), so "အပိုင္း ၄" (part 4) became
 * "အပိုင်း ၎". Hide such digits from the converter and put them back after.
 */
export function protectLoneFour(
  zawgyi: string,
  convert: (text: string) => string,
): string {
  if (!zawgyi.includes('\u1044')) return convert(zawgyi);
  const hidden = zawgyi.replace(LONE_FOUR, FOUR_PLACEHOLDER);
  return convert(hidden).replaceAll(FOUR_PLACEHOLDER, '\u1044');
}
