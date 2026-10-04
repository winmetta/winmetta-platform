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

export function fixZawgyiTitle(
  parts: { title: string; titleNote?: string },
  detector: ZawgyiDetector,
  converter: ZawgyiConverter,
): TitleFix {
  const whole = [parts.title, parts.titleNote].filter(Boolean).join(' ');
  const unchanged = (
    verdict: ZawgyiVerdict,
    probability: number,
  ): TitleFix => ({
    verdict,
    probability,
    title: parts.title,
    ...(parts.titleNote ? { titleNote: parts.titleNote } : {}),
  });
  if (!myanmar.test(whole)) return unchanged('unicode', 0);
  const probability = detector.getZawgyiProbability(whole);
  const marker = hasZawgyiMarker(whole);
  if (marker && probability >= CONVERT_THRESHOLD) {
    const note = parts.titleNote
      ? { titleNote: converter.zawgyiToUnicode(parts.titleNote) }
      : {};
    return {
      verdict: 'converted',
      probability,
      title: converter.zawgyiToUnicode(parts.title),
      ...note,
    };
  }
  if (marker) return unchanged('suspicious', probability);
  if (probability > AMBIGUOUS_THRESHOLD)
    return unchanged('ambiguous', probability);
  return unchanged('unicode', probability);
}
