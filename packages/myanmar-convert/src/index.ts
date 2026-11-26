export { ENCODINGS, convert, detect } from './convert.ts';
export type {
  ConvertNote,
  ConvertResult,
  Detected,
  Encoding,
} from './convert.ts';
export { unicodeToWinInnwa } from './win-innwa/from-unicode.ts';
export type { WinInnwaResult } from './win-innwa/from-unicode.ts';
export { winInnwaToUnicode } from './win-innwa/to-unicode.ts';
export * from './zawgyi.ts';
