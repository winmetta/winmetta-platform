// The view logic of the Pāḷi Dictionary page (docs/pali-dictionary.md §2.1): one reducer, pure, so the
// states are unit tested. Results already on screen stay while a new lookup loads or fails.
import type { IssueKind, LookupResponse } from './contract';

export type Phase =
  'empty' | 'loading' | 'found' | 'none' | 'error' | 'too-long';

/** The other reading of a query that found nothing, offered as "Did you mean …?". */
export interface Alternate {
  query: string;
  response: LookupResponse;
}

export interface DictionaryState {
  phase: Phase;
  query: string;
  /** The last answer with entries, or the last empty one. Kept while loading and after a failure. */
  response: LookupResponse | null;
  alternate: Alternate | null;
  issue: IssueKind | null;
  /** A source id the reader filtered to, or null for all. */
  filter: string | null;
}

export type Action =
  | { type: 'start'; query: string }
  | { type: 'success'; response: LookupResponse; alternate?: Alternate | null }
  | { type: 'failure'; kind: IssueKind }
  | { type: 'filter'; sourceId: string | null }
  | { type: 'clear' };

export const initialState: DictionaryState = {
  phase: 'empty',
  query: '',
  response: null,
  alternate: null,
  issue: null,
  filter: null,
};

export function reduce(
  state: DictionaryState,
  action: Action,
): DictionaryState {
  switch (action.type) {
    case 'start':
      return { ...state, phase: 'loading', query: action.query, issue: null };
    case 'success': {
      const found = action.response.groups.length > 0;
      return {
        ...state,
        phase: found ? 'found' : 'none',
        response: action.response,
        alternate: found ? null : (action.alternate ?? null),
        issue: null,
        filter: null,
      };
    }
    case 'failure':
      return {
        ...state,
        phase: action.kind === 'too-long' ? 'too-long' : 'error',
        issue: action.kind,
      };
    case 'filter':
      return { ...state, filter: action.sourceId };
    case 'clear':
      return initialState;
  }
}

/** Groups to show: all, or only the entries of the filtered dictionary. */
export function visibleGroups(state: DictionaryState) {
  const groups = state.response?.groups ?? [];
  const only = state.filter;
  if (!only) return groups;
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => entry.sourceId === only),
    }))
    .filter((group) => group.entries.length > 0);
}

/** The filter is offered once there are more than three dictionaries in the answer. */
export const showFilter = (response: LookupResponse | null): boolean =>
  (response?.sources.length ?? 0) > 3;

/** The button shows busy while a lookup runs. */
export const isBusy = (state: DictionaryState): boolean =>
  state.phase === 'loading';
