// The one `lookup()` the page imports (docs/pali-dictionary.md §4 and §6). Today a mock answers; later
// a router tries the CDN, then the API when it is switched on. Every answer is parsed with the same
// parser, so the page never sees an unchecked shape, and a key version that differs from the one this
// page was built for is an error, not "no result".
import {
  LookupError,
  MAX_QUERY_CHARS,
  parseLookupResponse,
  type LookupRequest,
  type LookupResponse,
} from './contract';
import { HEADWORD_KEY_VERSION } from './key';
import { mockLookup, SCENARIOS, type Scenario } from './mock';

export type Backend = (request: LookupRequest) => Promise<unknown>;

/**
 * Asks the backends in order. The first answer with entries wins; an empty answer or a failure moves
 * on to the next. If none has entries, an empty answer is returned, else the last failure is thrown.
 */
export async function route(
  backends: readonly Backend[],
  request: LookupRequest,
): Promise<LookupResponse> {
  let empty: LookupResponse | null = null;
  let failure: LookupError = new LookupError('error');
  for (const backend of backends) {
    try {
      const response = parseLookupResponse(await backend(request));
      if (response.keyVersion !== HEADWORD_KEY_VERSION)
        throw new LookupError('key-mismatch');
      if (response.groups.length > 0) return response;
      empty ??= response;
    } catch (error) {
      failure = error instanceof LookupError ? error : new LookupError('error');
    }
  }
  if (empty) return empty;
  throw failure;
}

/** The scenario named in `?mock=`, only where a build allows it (dev, or a test build). */
export function scenarioFromSearch(search: string, allowed: boolean): Scenario {
  if (!allowed) return 'ok';
  const value = new URLSearchParams(search).get('mock');
  return SCENARIOS.find((scenario) => scenario === value) ?? 'ok';
}

const scenariosAllowed =
  import.meta.env.DEV || import.meta.env.PUBLIC_PALI_MOCK_SCENARIOS === 'true';

export async function lookup(
  request: LookupRequest,
  backends?: readonly Backend[],
): Promise<LookupResponse> {
  if (request.q.length > MAX_QUERY_CHARS) throw new LookupError('too-long');
  const scenario = scenarioFromSearch(
    typeof location === 'undefined' ? '' : location.search,
    scenariosAllowed,
  );
  return route(backends ?? [(r) => mockLookup(r, { scenario })], request);
}
