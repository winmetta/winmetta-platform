// The Auto method: decide whether what the OS keyboard produced is Unicode or Zawgyi
// (docs/myanmar-input.md section 2.1). A wrong guess costs the reader one tap, so Pāḷi with stacked
// consonants, which scores as Zawgyi, is left as Unicode unless a Zawgyi-only pattern is present.

import {
  CONVERT_THRESHOLD,
  hasZawgyiMarker,
  zawgyiDetector,
} from '@winmetta/myanmar-convert';
import type { Evidence, InputSource, Note } from './methods.ts';

const MYANMAR_LETTER = /[\u1000-\u109F]/g;
const LATIN_LETTER = /[A-Za-z]/;
// Zawgyi types medial ya or ra before its consonant; in Unicode they always follow it.
const LEADING_MEDIAL =
  // eslint-disable-next-line no-misleading-character-class -- marks are matched as plain code points
  /(?<![\u1000-\u1021\u103B-\u103E\u1039])[\u103B\u103C](?=[\u1000-\u1021])/;
const AMBIGUOUS_THRESHOLD = 0.5;

/** From this many Burmese characters on, the detector's score is trusted on its own. */
export const LONG_TEXT_LETTERS = 40;

export interface AutoVerdict {
  source: Extract<InputSource, 'unicode' | 'zawgyi'>;
  evidence: Evidence;
  notes: Note[];
}

/** A pattern that cannot occur in valid Unicode: the project's marker list plus a leading medial. */
export const hasZawgyiTypingMarker = (text: string): boolean =>
  hasZawgyiMarker(text) || LEADING_MEDIAL.test(text);

/**
 * 1. No Burmese: unchanged; Latin letters suggest Win Innwa.
 * 2. Zawgyi: a marker, and for long text also a detector score of 0.9 or more; long text with a score
 *    of 0.9 or more and no marker is taken as Zawgyi too (evidence `score`).
 * 3. Otherwise Unicode, with the note `unsure` when the signs disagree.
 */
export function detectAuto(text: string): AutoVerdict {
  const letters = text.match(MYANMAR_LETTER)?.length ?? 0;
  if (letters === 0)
    return {
      source: 'unicode',
      evidence: 'none',
      notes: LATIN_LETTER.test(text) ? [{ code: 'suggest-win-innwa' }] : [],
    };

  const marker = hasZawgyiTypingMarker(text);
  const long = letters >= LONG_TEXT_LETTERS;
  const probability = zawgyiDetector().getZawgyiProbability(text);

  if (marker && (!long || probability >= CONVERT_THRESHOLD))
    return { source: 'zawgyi', evidence: 'marker', notes: [] };
  if (long && probability >= CONVERT_THRESHOLD)
    return { source: 'zawgyi', evidence: 'score', notes: [] };
  if (marker || probability > AMBIGUOUS_THRESHOLD)
    return { source: 'unicode', evidence: 'none', notes: [{ code: 'unsure' }] };
  return {
    source: 'unicode',
    evidence: long ? 'score' : 'none',
    notes: [],
  };
}
