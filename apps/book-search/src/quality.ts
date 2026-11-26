import { countZawgyiMarkers } from '@winmetta/myanmar-convert/zawgyi';

// Whether one page's text layer can be indexed as it is, or the page must be read by OCR.
export type TextLayerReason = 'too_little_text' | 'zawgyi' | 'legacy_font';

export interface TextLayerVerdict {
  usable: boolean;
  reasons: TextLayerReason[];
}

/** Fewer letters than this is a blank or image-only page (or a lone page number). */
export const MIN_LETTERS = 20;
/** Zawgyi-only patterns (docs/book-search.md §4): a few on a whole page is not a typo. */
export const ZAWGYI_MARKER_LIMIT = 3;
/** In a Burmese book, a page with under this share of Myanmar letters is not Burmese text. */
const MIN_MYANMAR_SHARE = 0.1;
/** Share of odd symbols (not letters, digits, spaces or plain punctuation) that marks garbage. */
const MAX_ODD_SHARE = 0.15;

const count = (text: string, pattern: RegExp): number =>
  text.match(pattern)?.length ?? 0;

export function checkTextLayer(
  text: string,
  bookLanguage: string,
): TextLayerVerdict {
  const myanmarLetters = count(text, /[က-ဪ]/g);
  const letters = count(text, /\p{L}/gu);
  const reasons: TextLayerReason[] = [];
  if (Math.max(letters, myanmarLetters) < MIN_LETTERS)
    reasons.push('too_little_text');
  if (countZawgyiMarkers(text) >= ZAWGYI_MARKER_LIMIT) reasons.push('zawgyi');
  if (
    letters >= MIN_LETTERS &&
    isLegacyFontText(text, bookLanguage, myanmarLetters, letters)
  )
    reasons.push('legacy_font');
  return { usable: reasons.length === 0, reasons };
}

/**
 * Old Burmese fonts (Win Innwa and similar) extract as Latin-looking garbage or private-use
 * characters. Heuristic: private-use characters, or in a Burmese book almost no Myanmar letters
 * together with many odd symbols, or with too few common English words (a legacy font mapped onto
 * ASCII letters, such as `ausmfpf GmG a'guf`, found on real library pages). In an
 * English book such a page cannot be told from English, so it stays a known gap (docs/book-search.md §11).
 */
function isLegacyFontText(
  text: string,
  bookLanguage: string,
  myanmarLetters: number,
  letters: number,
): boolean {
  if (count(text, /[\uE000-\uF8FF]/g) >= 3) return true;
  if (bookLanguage !== 'my' || myanmarLetters / letters >= MIN_MYANMAR_SHARE)
    return false;
  const visible = text.replace(/\s/g, '');
  const odd = count(visible, /[^\p{L}\p{N}.,;:'"()\-!?]/gu);
  if (visible.length > 0 && odd / visible.length >= MAX_ODD_SHARE) return true;
  // Latin-looking text that is not English: a legacy font mapped onto ASCII letters.
  const words = latinWords(text);
  return words.length >= MIN_WORDS_FOR_SHARE
    ? englishShare(words) < MIN_ENGLISH_SHARE
    : englishCount(words) < MIN_ENGLISH_WORDS;
}

const stopwords = new Set(
  'the of and to in is a that for it as with was on by be this are which from or an his her not but have had at they'.split(
    ' ',
  ),
);
const latinWords = (text: string): string[] =>
  text.toLowerCase().match(/[a-z]+/g) ?? [];
const englishCount = (words: string[]): number =>
  words.filter((word) => stopwords.has(word)).length;
const englishShare = (words: string[]): number =>
  englishCount(words) / words.length;
/** Short pages: real English has a few common words, ASCII-mapped garbage almost none. */
const MIN_ENGLISH_WORDS = 3;
/**
 * Longer pages: a long page of garbage still hits a few short words by chance, so the share is
 * used. Measured on real library pages (2026-11-20): garbage 0.01 to 0.08, English 0.16 to 0.40.
 */
const MIN_WORDS_FOR_SHARE = 15;
const MIN_ENGLISH_SHARE = 0.12;
