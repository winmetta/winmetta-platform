// Sample data for the mock (docs/pali-dictionary.md §4.1). The sources are invented placeholders and
// every definition is visibly placeholder text: dictionary content comes from the books, not from us,
// and the page says "Sample entries" while this is what answers. Real, reviewed excerpts replace it
// once the dictionary repository's Stage 2 output is cleared.
import type { Entry, SourceMeta } from './contract';

export const sources: readonly SourceMeta[] = [
  { sourceId: 'sample-a', title: 'Sample dictionary A', licenseId: 'sample' },
  { sourceId: 'sample-b', title: 'Sample dictionary B', licenseId: 'sample' },
  {
    sourceId: 'sample-c',
    title: 'Sample dictionary C (read by OCR)',
    licenseId: 'sample',
    attribution: 'Placeholder attribution for a licence that needs one.',
  },
];

const text = (n: number) =>
  `Sample text ${n}. Placeholder, not from any dictionary.`;

const a = (n: number, extra: Partial<Entry> = {}): Entry => ({
  sourceId: 'sample-a',
  definitionText: text(n),
  quality: 'proofed',
  licenseId: 'sample',
  volumeCode: '1',
  printedPage: 10 + n,
  ...extra,
});
const b = (n: number, extra: Partial<Entry> = {}): Entry => ({
  ...a(n),
  sourceId: 'sample-b',
  volumeCode: '2',
  printedPage: 100 + n,
  ...extra,
});
const c = (n: number): Entry => ({
  ...a(n),
  sourceId: 'sample-c',
  quality: 'ocr',
  volumeCode: undefined,
  printedPage: undefined,
});

export interface SampleWord {
  headword: string;
  headwordIast: string;
  entries: Entry[];
}

/** Twelve headwords: one source, several sources, an OCR row, near words for prefix matches. */
export const words: readonly SampleWord[] = [
  {
    headword: 'ဓမ္မ',
    headwordIast: 'dhamma',
    entries: [a(1, { pos: 'noun' }), b(2), c(3)],
  },
  { headword: 'ဓမ္မပဒ', headwordIast: 'dhammapada', entries: [a(4)] },
  { headword: 'ဓမ္မစက္က', headwordIast: 'dhammacakka', entries: [a(5), b(6)] },
  {
    headword: 'သတ္တ',
    headwordIast: 'satta',
    entries: [a(7, { pos: 'noun', etymology: 'Placeholder etymology.' })],
  },
  { headword: 'ပါဠိ', headwordIast: 'pāḷi', entries: [a(8), c(9)] },
  { headword: 'ဗုဒ္ဓ', headwordIast: 'buddha', entries: [a(10), b(11)] },
  { headword: 'သင်္ဃ', headwordIast: 'saṅgha', entries: [a(12), b(13)] },
  { headword: 'ဉာဏ', headwordIast: 'ñāṇa', entries: [b(14)] },
  { headword: 'ဥပါဒါန', headwordIast: 'upādāna', entries: [a(15)] },
  { headword: 'ကမ္မ', headwordIast: 'kamma', entries: [a(16), b(17), c(18)] },
  { headword: 'သီလ', headwordIast: 'sīla', entries: [a(19)] },
  { headword: 'နိဗ္ဗာန', headwordIast: 'nibbāna', entries: [a(20), b(21)] },
];
