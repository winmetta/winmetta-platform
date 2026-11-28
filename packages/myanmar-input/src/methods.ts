/** How a reader types Burmese. `zawgyi` is reserved: Zawgyi typing is covered by `auto`. */
export type InputMethod = 'auto' | 'unicode' | 'win-innwa';

export const INPUT_METHODS: readonly InputMethod[] = [
  'auto',
  'unicode',
  'win-innwa',
];

/** What the text was, as far as the package could tell. */
export type InputSource = 'unicode' | 'zawgyi' | 'win-innwa';

/** How sure Auto was: an impossible-in-Unicode pattern, the detector alone (long text), or neither. */
export type Evidence = 'marker' | 'score' | 'none';

/** Something the package changed. Codes, not sentences, so the page can say it in the reader's language. */
export type Fix =
  | 'moved-e'
  | 'reordered-marks'
  | 'moved-stack'
  | 'merged-nya-u'
  | 'removed-zero-width'
  | 'removed-duplicate-marks'
  | 'zawgyi-converted';

/** Something the page may want to tell the reader that is not a change to the text. */
export type Note =
  /** Could not tell Unicode from Zawgyi; Unicode was used. */
  | { code: 'unsure' }
  /** Latin letters were typed in Auto; the reader may be typing Burmese on an English keyboard. */
  | { code: 'suggest-win-innwa' }
  /** The text has Latin letters or symbols, which a Win Innwa font draws as Burmese. */
  | { code: 'latin-in-win-innwa' }
  /** Some Burmese characters have no Win Innwa glyph and were kept as Unicode (`chars`). */
  | { code: 'unmapped'; chars: string[] };

export type FontKind = 'unicode' | 'zawgyi' | 'win-innwa';
