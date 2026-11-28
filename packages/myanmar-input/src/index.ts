export { canonicalize } from './canonical.ts';
export type { Canonicalized } from './canonical.ts';
export { detectAuto, LONG_TEXT_LETTERS } from './auto.ts';
export type { AutoVerdict } from './auto.ts';
export { fontFor } from './fonts.ts';
export { createKeyEngine, keyGroups } from './keys.ts';
export type {
  KeyAction,
  KeyEngine,
  KeyEngineOptions,
  KeyEvent,
  KeyGroup,
  KeyKind,
  TrayKey,
} from './keys.ts';
export { INPUT_METHODS } from './methods.ts';
export type {
  Evidence,
  Fix,
  FontKind,
  InputMethod,
  InputSource,
  Note,
} from './methods.ts';
export { resolveInput, switchMethod } from './resolve.ts';
export type { ResolveOptions, ResolvedInput } from './resolve.ts';
