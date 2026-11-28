import type { FontKind, InputMethod } from './methods.ts';
import type { ResolvedInput } from './resolve.ts';

/** Which font the box should use. Auto shows Zawgyi only when the last result was Zawgyi. */
export function fontFor(
  method: InputMethod,
  result?: Pick<ResolvedInput, 'source'>,
): FontKind {
  if (method === 'win-innwa') return 'win-innwa';
  if (method === 'auto' && result?.source === 'zawgyi') return 'zawgyi';
  return 'unicode';
}
