// Analytics events of the Burmese text converter (docs/myanmar-converter.md §11, analytics.md §3).
// Every property comes from a fixed list or a bucket, so neither the text nor its exact length can
// reach the tracker, and the detector's verdict on a particular text is never sent (`from` is
// what the reader chose, which may be Auto). Pure builders; the island passes the result to `track`.
import type { Encoding } from '@winmetta/myanmar-convert';
import type { FromChoice, Issue } from './text-converter';

export type LengthBucket = '1-100' | '101-1000' | '1001-10000' | 'more';

/** Characters to a bucket. */
export function bucketChars(chars: number): LengthBucket {
  if (chars <= 100) return '1-100';
  if (chars <= 1000) return '101-1000';
  if (chars <= 10_000) return '1001-10000';
  return 'more';
}

export type ConverterEvent = {
  name: string;
  data: Record<string, string>;
};

/** The first conversion in a page view: the number of visitors who convert something. */
export const convert = (
  from: FromChoice,
  to: Encoding,
  chars: number,
): ConverterEvent => ({
  name: 'converter_convert',
  data: { from, to, length: bucketChars(chars) },
});

/** `box` says which text was copied: what the reader typed, or the result. */
export const copy = (
  box: 'input' | 'result',
  from: FromChoice,
  to: Encoding,
  chars: number,
): ConverterEvent => ({
  name: 'converter_copy',
  data: { box, from, to, length: bucketChars(chars) },
});

export const swap = (): ConverterEvent => ({
  name: 'converter_swap',
  data: {},
});

export const clear = (): ConverterEvent => ({
  name: 'converter_clear',
  data: {},
});

/** The font the reader picked for the input box. */
export const fontChange = (font: Encoding): ConverterEvent => ({
  name: 'converter_font_change',
  data: { font },
});

export const encodingChange = (
  side: 'from' | 'to',
  value: FromChoice,
): ConverterEvent => ({
  name: 'converter_encoding_change',
  data: { side, value },
});

/** Auto could not tell the encoding, or the text was too long. */
export const issue = (kind: Issue): ConverterEvent => ({
  name: 'converter_issue',
  data: { kind },
});

/** The converters could not be loaded (no properties). */
export const loadError = (): ConverterEvent => ({
  name: 'converter_load_error',
  data: {},
});
