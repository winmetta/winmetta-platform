import { zawgyiConverter, zawgyiDetector } from './google.ts';
import { unicodeToWinInnwa } from './win-innwa/from-unicode.ts';
import { winInnwaToUnicode } from './win-innwa/to-unicode.ts';
import { classifyZawgyi, hasZawgyiMarker } from './zawgyi.ts';
import { protectLoneFour, unicodeToZawgyiStackedE } from './zawgyi-fixes.ts';

export type Encoding = 'unicode' | 'zawgyi' | 'win-innwa';

export const ENCODINGS: readonly Encoding[] = [
  'unicode',
  'zawgyi',
  'win-innwa',
];

/**
 * Something the caller should tell the user about a conversion. Codes, not sentences, so the page
 * can show them in the reader's language.
 */
export type ConvertNote =
  /** Some Burmese characters have no Win Innwa glyph and were kept as Unicode (`chars`). */
  | { code: 'unmapped'; chars: string[] }
  /** The text has Latin letters or symbols, which a Win Innwa font draws as Burmese. */
  | { code: 'latin-in-win-innwa' }
  /** The source was given as Zawgyi but reads as Unicode, so converting it may damage it. */
  | { code: 'source-looks-unicode' }
  /** The source was given as Unicode but has patterns only Zawgyi uses. */
  | { code: 'source-looks-zawgyi' };

export interface ConvertResult {
  text: string;
  notes: ConvertNote[];
}

export type Detected = 'unicode' | 'zawgyi' | 'unsure' | 'no-myanmar';

/**
 * Tells Unicode from Zawgyi with the same two-gate rule the library uses for titles (zawgyi.ts): Zawgyi
 * only when the detector and a Zawgyi-only pattern agree, so Pāḷi with stacked consonants is not
 * mistaken for Zawgyi. Win Innwa is never detected: its text is plain Latin letters.
 */
export function detect(text: string): Detected {
  const verdict = classifyZawgyi(text, zawgyiDetector());
  if (verdict === 'no-myanmar') return 'no-myanmar';
  if (verdict === 'zawgyi') return 'zawgyi';
  if (verdict === 'unicode') return 'unicode';
  return 'unsure';
}

function toUnicode(text: string, from: Encoding, notes: ConvertNote[]): string {
  if (from === 'unicode') {
    if (hasZawgyiMarker(text)) notes.push({ code: 'source-looks-zawgyi' });
    return text;
  }
  if (from === 'zawgyi') {
    if (classifyZawgyi(text, zawgyiDetector()) === 'unicode')
      notes.push({ code: 'source-looks-unicode' });
    const converter = zawgyiConverter();
    return protectLoneFour(text, (t) => converter.zawgyiToUnicode(t));
  }
  return winInnwaToUnicode(text);
}

function fromUnicode(text: string, to: Encoding, notes: ConvertNote[]): string {
  if (to === 'unicode') return text;
  if (to === 'zawgyi') {
    const converter = zawgyiConverter();
    return unicodeToZawgyiStackedE(text, (t) => converter.unicodeToZawgyi(t));
  }
  const result = unicodeToWinInnwa(text);
  if (result.unmapped.length > 0)
    notes.push({ code: 'unmapped', chars: result.unmapped });
  if (result.hasLatin) notes.push({ code: 'latin-in-win-innwa' });
  return result.text;
}

/**
 * Converts text between Unicode, Zawgyi and Win Innwa, always through Unicode. Converting to the
 * same encoding returns the text unchanged. Unicode output is NFC.
 */
export function convert(
  text: string,
  from: Encoding,
  to: Encoding,
): ConvertResult {
  if (from === to) return { text, notes: [] };
  const notes: ConvertNote[] = [];
  const unicode = toUnicode(text, from, notes).normalize('NFC');
  return { text: fromUnicode(unicode, to, notes), notes };
}
