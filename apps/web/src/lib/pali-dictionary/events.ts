// Analytics events of the Pāḷi Dictionary (docs/pali-dictionary.md §9, analytics.md §3). Every property
// is a fixed word or a bucket: never the typed text, the matched word, a definition, the sources an
// answer came from, an exact length, or the detector's verdict on a particular text. Pure builders; the
// island passes the result to `track`.
import type { InputMethod } from '@winmetta/myanmar-input';
import type { IssueKind, LookupResponse, MatchKind, Via } from './contract';

export type DictionaryEvent = {
  name: string;
  data: Record<string, string>;
};

export type QueryLengthBucket = '1-5' | '6-15' | '16+';
export type ResultsBucket = '0' | '1' | '2-3' | '4+';

export function bucketQueryLength(chars: number): QueryLengthBucket {
  if (chars <= 5) return '1-5';
  if (chars <= 15) return '6-15';
  return '16+';
}

/** Dictionaries in an answer, not entries. */
export function bucketResults(dictionaries: number): ResultsBucket {
  if (dictionaries <= 0) return '0';
  if (dictionaries === 1) return '1';
  if (dictionaries <= 3) return '2-3';
  return '4+';
}

export const lookup = (
  method: InputMethod,
  queryChars: number,
  response: Pick<LookupResponse, 'matchKind' | 'via'> & {
    sources: readonly unknown[];
  },
): DictionaryEvent => ({
  name: 'pali_lookup',
  data: {
    method,
    length: bucketQueryLength(queryChars),
    match: response.matchKind satisfies MatchKind,
    results: bucketResults(response.sources.length),
    via: response.via satisfies Via,
  },
});

export const example = (): DictionaryEvent => ({
  name: 'pali_example',
  data: {},
});

export const retry = (
  kind: 'other-reading' | 'search-as-zawgyi',
): DictionaryEvent => ({ name: 'pali_retry', data: { kind } });

export const related = (): DictionaryEvent => ({
  name: 'pali_related',
  data: {},
});

export const filter = (scope: 'all' | 'one'): DictionaryEvent => ({
  name: 'pali_filter',
  data: { scope },
});

export const share = (): DictionaryEvent => ({ name: 'pali_share', data: {} });

/** A word with no entry is `pali_lookup` with `match` none, not an issue. */
export const issue = (kind: IssueKind): DictionaryEvent => ({
  name: 'pali_issue',
  data: { kind },
});
