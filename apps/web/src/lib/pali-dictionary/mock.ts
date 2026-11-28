// The mock lookup (docs/pali-dictionary.md §4.1): answers like the real service from the sample data,
// after a short delay. It returns the raw answer so the page parses it with the same parser as the
// real service. `scenario` forces a failure or a slow answer for tests.
import { HEADWORD_KEY_VERSION, headwordKey } from './key';
import type { LookupRequest } from './contract';
import { sources, words, type SampleWord } from './fixtures';

export type Scenario = 'ok' | 'error' | 'slow' | 'key-mismatch';
export const SCENARIOS: readonly Scenario[] = [
  'ok',
  'error',
  'slow',
  'key-mismatch',
];

export interface MockOptions {
  scenario?: Scenario;
  /** Milliseconds to wait before answering. Default 300 to 600; `slow` waits 4 seconds. */
  delayMs?: number;
}

const index = words.map((word) => ({ word, key: headwordKey(word.headword) }));
const CONSONANT = /[က-အ]/g;
const NEAR_PREFIX = 2;

const consonants = (key: string) => key.match(CONSONANT)?.length ?? 0;

function find(q: string) {
  const key = headwordKey(q);
  const canonical = q.normalize('NFC');
  const exact = index.filter((item) => item.word.headword === canonical);
  if (exact.length > 0) return { kind: 'exact' as const, key, hits: exact };
  const loose = index.filter((item) => item.key === key);
  if (loose.length > 0) return { kind: 'loose' as const, key, hits: loose };
  if (consonants(key) >= 2) {
    const prefix = index.filter((item) => item.key.startsWith(key));
    if (prefix.length > 0)
      return { kind: 'prefix' as const, key, hits: prefix };
  }
  return { kind: 'none' as const, key, hits: [] };
}

function groupsOf(hits: { word: SampleWord }[], only?: string[]) {
  return hits
    .map(({ word }) => ({
      headword: word.headword,
      headwordIast: word.headwordIast,
      entries: word.entries.filter(
        (entry) => !only || only.includes(entry.sourceId),
      ),
    }))
    .filter((group) => group.entries.length > 0);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockLookup(
  request: LookupRequest,
  options: MockOptions = {},
): Promise<unknown> {
  const scenario = options.scenario ?? 'ok';
  const delay =
    options.delayMs ?? (scenario === 'slow' ? 4000 : 300 + Math.random() * 300);
  await wait(delay);
  if (scenario === 'error') throw new Error('mock failure');

  const found = find(request.q);
  const groups = groupsOf(found.hits, request.sources).slice(
    0,
    request.limit ?? 20,
  );
  const shown = new Set(groups.map((group) => group.headword));
  const near = found.key.slice(0, NEAR_PREFIX);
  const related =
    found.kind === 'none'
      ? []
      : index
          .filter(
            (item) =>
              !shown.has(item.word.headword) && item.key.startsWith(near),
          )
          .map((item) => item.word.headword)
          .slice(0, 5);
  const ids = new Set(groups.flatMap((g) => g.entries.map((e) => e.sourceId)));
  return {
    v: 1,
    q: request.q,
    keyVersion:
      scenario === 'key-mismatch'
        ? HEADWORD_KEY_VERSION + 1
        : HEADWORD_KEY_VERSION,
    via: 'mock',
    matchKind: groups.length > 0 ? found.kind : 'none',
    groups,
    related,
    sources: sources.filter((source) => ids.has(source.sourceId)),
    mock: true,
  };
}
