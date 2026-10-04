// Legacy Zawgyi filenames in the S3 bucket (PDFs named years ago) look like Unicode but use
// different code points, so they render scrambled and never match Unicode queries.
// The generator detects them with Google's myanmar-tools and converts them. The detector
// alone is NOT safe here: Pāḷi titles full of stacked consonants (ဓမ္မ, ပတ္တိ) often score as
// Zawgyi and the converter would damage them. So conversion needs the detector AND a marker
// that cannot occur in valid Unicode.

// U+1060-U+1097: Shan/Karen letters that Zawgyi reuses as glyphs (not in Burmese or Pāḷi text).
const glyphOnly = /[\u1060-\u1097]/;
// ေ (U+1031) must follow a consonant or medial in Unicode; Zawgyi types it before the consonant.
const eVowelFirst = /(?<![\u1000-\u1021])(?<![\u103B-\u103E\u1039])\u1031/;
// Zawgyi uses the virama U+1039 as asat; in Unicode it is always followed by a consonant.
const looseVirama = /\u1039(?![\u1000-\u1021])/;
const myanmar = /[\u1000-\u109F]/;

export interface ZawgyiDetector {
  getZawgyiProbability(text: string): number;
}
export interface ZawgyiConverter {
  zawgyiToUnicode(text: string): string;
}

export const hasZawgyiMarker = (text: string): boolean =>
  glyphOnly.test(text) || eVowelFirst.test(text) || looseVirama.test(text);

export const CONVERT_THRESHOLD = 0.9;
const AMBIGUOUS_THRESHOLD = 0.5;

/**
 * converted: marker and detector agree, so the text was converted.
 * suspicious: marker present but the detector says Unicode (often a typo); left unchanged.
 * ambiguous: detector says Zawgyi but no marker (usually Pāḷi); left unchanged.
 */
export type ZawgyiVerdict =
  'unicode' | 'converted' | 'suspicious' | 'ambiguous';

export interface TitleFix {
  verdict: ZawgyiVerdict;
  probability: number;
  title: string;
  titleNote?: string;
}

interface TextFix {
  verdict: ZawgyiVerdict;
  probability: number;
  text: string;
}

/** Classifies one piece of text on its own; only this text is ever converted. */
function fixText(
  text: string,
  detector: ZawgyiDetector,
  converter: ZawgyiConverter,
): TextFix {
  if (!myanmar.test(text)) return { verdict: 'unicode', probability: 0, text };
  const probability = detector.getZawgyiProbability(text);
  const marker = hasZawgyiMarker(text);
  if (marker && probability >= CONVERT_THRESHOLD)
    return {
      verdict: 'converted',
      probability,
      text: converter.zawgyiToUnicode(text),
    };
  if (marker) return { verdict: 'suspicious', probability, text };
  if (probability > AMBIGUOUS_THRESHOLD)
    return { verdict: 'ambiguous', probability, text };
  return { verdict: 'unicode', probability, text };
}

const severity: Record<ZawgyiVerdict, number> = {
  unicode: 0,
  ambiguous: 1,
  suspicious: 2,
  converted: 3,
};

/**
 * The title and its parenthetical note are classified and converted independently: a
 * filename can mix a Unicode title with a Zawgyi note (or the reverse), and converting
 * already-Unicode text corrupts it. The verdict reports the most notable part.
 */
export function fixZawgyiTitle(
  parts: { title: string; titleNote?: string },
  detector: ZawgyiDetector,
  converter: ZawgyiConverter,
): TitleFix {
  const title = fixText(parts.title, detector, converter);
  const note = parts.titleNote
    ? fixText(parts.titleNote, detector, converter)
    : undefined;
  const notable =
    note && severity[note.verdict] > severity[title.verdict] ? note : title;
  return {
    verdict: notable.verdict,
    probability: Math.max(title.probability, note?.probability ?? 0),
    title: title.text,
    ...(note ? { titleNote: note.text } : {}),
  };
}
