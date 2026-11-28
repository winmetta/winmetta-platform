// Analytics events of the Burmese typing setting and the shared field (docs/myanmar-input.md §10,
// analytics.md §3). Every property comes from a fixed list: never the text typed, the Unicode it
// became, which letters were fixed or the detector's verdict on a particular text. Pure builders;
// the field and the Settings page pass the result to `track`.
import type {
  Fix,
  InputMethod,
  KeyKind,
  Note,
  ResolvedInput,
} from '@winmetta/myanmar-input';

export type InputEvent = {
  name: string;
  data: Record<string, string | boolean>;
};

/** `via` says where the reader changed it: the Settings page or a field. */
export const methodChange = (
  method: InputMethod,
  via: 'settings' | 'field',
): InputEvent => ({
  name: 'input_method_change',
  data: { method, via },
});

export const stackKeyChange = (on: boolean): InputEvent => ({
  name: 'input_stack_key_change',
  data: { on },
});

/** `app` is the mini app's registry id (lib/mini-apps.ts). */
export const keysUse = (app: string, kind: KeyKind): InputEvent => ({
  name: 'input_keys_use',
  data: { app, kind },
});

type AutoFixCode = Fix | Extract<Note['code'], 'unsure'>;
const AUTO_FIX_CODES: readonly AutoFixCode[] = [
  'moved-e',
  'reordered-marks',
  'moved-stack',
  'merged-nya-u',
  'removed-zero-width',
  'removed-duplicate-marks',
  'zawgyi-converted',
  'unsure',
];

export const autoFix = (app: string, fix: AutoFixCode): InputEvent => ({
  name: 'input_auto_fix',
  data: { app, fix },
});

/**
 * One event per code Auto changed or could not tell, for an app to send once per lookup or submit.
 * Nothing for other methods, and no event for notes that are not in the list.
 */
export function autoFixEvents(
  app: string,
  method: InputMethod,
  result: Pick<ResolvedInput, 'fixes' | 'notes'>,
): InputEvent[] {
  if (method !== 'auto') return [];
  const codes = new Set<string>([
    ...result.fixes,
    ...result.notes.map((note) => note.code),
  ]);
  return AUTO_FIX_CODES.filter((code) => codes.has(code)).map((code) =>
    autoFix(app, code),
  );
}
