// INTERIM headword key (docs/pali-dictionary.md §4.1). A TypeScript port of to_headword_norm in
// winmetta/pali-myanmar-dictionaries (src/pali_myanmar_dicts/normalize.py), checked against golden
// vectors generated from the Python function (key.vectors.json). Delete this file when
// @winmetta/pali-text has a pinned release: the import in client.ts and mock.ts is the only change.
import { canonicalize } from '@winmetta/myanmar-input';

/** Bumped whenever the key rules change; a client refuses data built with another version. */
export const HEADWORD_KEY_VERSION = 1;

const ZERO_WIDTH = /[\u200b-\u200d\ufeff\u00ad]/g;
const BLANKS = /[ \t\f\v]+/g;
const LINE_BREAKS = /\r\n|\r|\n/g;
// Syllable-initial ဉ confused for ဥ or ဦ (ဉပေက္ခာ -> ဥပေက္ခာ, လက်ဉီး -> လက်ဦး).
const INITIAL_NYA_AS_U = /(?:(?<![က-ဿ])ဉ(?![ါ-ို-ှ])|(?<!္)ဉ(?=ီ))/g;
// Spaces, punctuation and digits take no part in matching.
const STRIP = /[\s\-–—_.,;:!?"'“”‘’()[\]{}၊။…/\\+=0-9၀-၉]+/g;
const KINZI_BEFORE_VELAR = /င်္(?=[က-င])/g;

/**
 * The loose lookup key: folds tall ါ, kinzi and ံ, stacked consonants, ဿ, ှ and ဉီး, and drops spaces
 * and punctuation, so ဓမ္မ, ဓမမ and ဓမ္မာ meet. Applied by whoever answers a lookup, never by a page.
 */
export function headwordKey(text: string): string {
  const single = text
    .replace(ZERO_WIDTH, '')
    .replace(LINE_BREAKS, ' ')
    .replace(BLANKS, ' ')
    .trim();
  let key = canonicalize(single).text;
  key = key.replace(INITIAL_NYA_AS_U, 'ဥ').normalize('NFC');
  key = key.replace(STRIP, '');
  key = key.replace(KINZI_BEFORE_VELAR, 'ံ');
  key = key
    .replaceAll('ါ', 'ာ')
    .replaceAll('ဿ', 'သသ')
    .replaceAll('ှ', 'ဟ')
    .replaceAll('္', '');
  return key.normalize('NFC');
}
