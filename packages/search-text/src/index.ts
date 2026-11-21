export { burmeseSyllables, splitScripts } from './burmese.ts';
export type { ScriptRun } from './burmese.ts';
export { normalizeSearch } from './normalize.ts';
export {
  FTS_TOKENIZE,
  MAX_GRAM,
  MIN_SIMILARITY,
  TERM_SEPARATOR,
  buildQueries,
  chunkTerms,
  compact,
  ftsTokens,
  indexTerms,
  similarity,
  titleTier,
} from './search-text.ts';
export type { FtsTokens } from './search-text.ts';
