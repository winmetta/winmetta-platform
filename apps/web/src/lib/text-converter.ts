// The logic of the Burmese text converter mini app (docs/myanmar-converter.md §6), kept apart from
// the page so it can be tested without a browser. The converters themselves load on first use.
import type {
  ConvertNote,
  Detected,
  Encoding,
} from '@winmetta/myanmar-convert';

/** What the reader picks as the source: an encoding, or let the page work it out. */
export type FromChoice = 'auto' | Encoding;

/** About 200,000 characters, so a mistaken paste of a whole book does not freeze the page. */
export const MAX_CHARS = 200_000;

export interface Converter {
  convert: (
    text: string,
    from: Encoding,
    to: Encoding,
  ) => { text: string; notes: ConvertNote[] };
  detect: (text: string) => Detected;
}

export type Issue = 'too-long' | 'choose-source';

export interface View {
  output: string;
  /** What the text was taken to be; null when there was nothing to convert. */
  source: Encoding | null;
  /** True when `source` was found by Auto rather than chosen. */
  detected: boolean;
  /** Auto found no Burmese letters, so the text is passed through. */
  noBurmese: boolean;
  /** The source and the target are the same encoding. */
  same: boolean;
  notes: ConvertNote[];
  issue: Issue | null;
}

const EMPTY: View = {
  output: '',
  source: null,
  detected: false,
  noBurmese: false,
  same: false,
  notes: [],
  issue: null,
};

/** Converts `text`, or says why it did not: too long, or Auto could not tell the encoding. */
export function run(
  text: string,
  from: FromChoice,
  to: Encoding,
  converter: Converter,
): View {
  if (text.length === 0) return EMPTY;
  if (text.length > MAX_CHARS) return { ...EMPTY, issue: 'too-long' };
  let source: Encoding;
  let detected = false;
  let noBurmese = false;
  if (from === 'auto') {
    const found = converter.detect(text);
    if (found === 'unsure') return { ...EMPTY, issue: 'choose-source' };
    detected = true;
    noBurmese = found === 'no-myanmar';
    source = found === 'zawgyi' ? 'zawgyi' : 'unicode';
  } else {
    source = from;
  }
  const { text: output, notes } = converter.convert(text, source, to);
  return {
    output,
    source,
    detected,
    noBurmese,
    same: source === to,
    notes,
    issue: null,
  };
}

/**
 * The choices after Swap: what the text was becomes the target and the target becomes the
 * source. With Auto, the source is what Auto found (Unicode when it found nothing).
 */
export function swap(
  from: FromChoice,
  to: Encoding,
  found: Encoding | null,
): { from: Encoding; to: Encoding } {
  return { from: to, to: from === 'auto' ? (found ?? 'unicode') : from };
}
