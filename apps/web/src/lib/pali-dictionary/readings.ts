// The other reading of what was typed, and the example words (docs/pali-dictionary.md §3). Pure.
import { convert } from '@winmetta/myanmar-convert';
import {
  canonicalize,
  switchMethod,
  type InputMethod,
  type ResolvedInput,
} from '@winmetta/myanmar-input';

/** Words that fill an empty box, in Unicode. */
export const EXAMPLES: readonly string[] = ['ဓမ္မ', 'သတ္တ', 'ဗုဒ္ဓ'];

/** What the box holds for an example word: glyph codes in Win Innwa, Unicode otherwise. */
export const exampleRaw = (word: string, method: InputMethod): string =>
  switchMethod(word, 'unicode', method).raw;

/** The input read as Zawgyi, as Unicode. This is what "Search as Zawgyi" looks up. */
export const asZawgyi = (raw: string): string =>
  canonicalize(convert(raw, 'zawgyi', 'unicode').text).text;

/**
 * The other reading to try once when a lookup finds nothing, or null when there is none. In Auto it is
 * the reading Auto did not choose; As typed can only be read as Zawgyi; Win Innwa has no other reading.
 */
export function otherReading(
  raw: string,
  method: InputMethod,
  result: Pick<ResolvedInput, 'source' | 'unicode'>,
): string | null {
  if (method === 'win-innwa') return null;
  const candidate =
    method === 'auto' && result.source === 'zawgyi'
      ? canonicalize(raw).text
      : asZawgyi(raw);
  return candidate !== result.unicode && candidate.trim() !== ''
    ? candidate
    : null;
}
