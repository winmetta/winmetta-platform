// The DOM adapter (docs/myanmar-input.md section 3): attaches the key engine and paste handling to any
// <input> or <textarea>. It rewrites text only inside a keydown or paste of its own, and never between
// compositionstart and compositionend, so phone keyboards (Gboard Myanmar and similar) are left alone.
// Dead keys need real key events, so they work on desktop keyboards; a virtual keyboard sends
// "Unidentified" keys during composition and is passed through.

import { createKeyEngine, type KeyEngine } from './keys.ts';
import type { InputMethod, Note } from './methods.ts';
import { switchMethod } from './resolve.ts';

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export interface AttachOptions {
  method: InputMethod;
  /** Shift+F stacks and `ff` is kinzi in Win Innwa. Default true. */
  stackKey?: boolean;
  /** Pasted Unicode Burmese was turned into Win Innwa glyph codes (`notes` lists what had no glyph). */
  onPasteConverted?: (notes: Note[]) => void;
}

export interface InputHandle {
  /** Applies a new method or setting, for example when the reader changes it. */
  update(options: Partial<AttachOptions>): void;
  detach(): void;
}

const BURMESE = /[\u1000-\u109F]/;

/**
 * Types `text` at the caret, replacing the selection and `replace` characters before it, and tells the
 * page with a normal `input` event so framework state follows. The keys tray uses this too.
 * Returns false for a field that has no caret (an email or number input).
 */
export function insertAtCaret(
  field: TextField,
  text: string,
  replace = 0,
): boolean {
  const { selectionStart, selectionEnd } = field;
  if (selectionStart === null || selectionEnd === null) return false;
  const start = Math.max(0, selectionStart - replace);
  field.setRangeText(text, start, selectionEnd, 'end');
  field.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }),
  );
  return true;
}

export function attachInput(
  field: TextField,
  initial: AttachOptions,
): InputHandle {
  let options = initial;
  let engine: KeyEngine = build();
  let composing = false;
  // HTMLElement carries the typed event map; the field union does not.
  const target: HTMLElement = field;

  function build(): KeyEngine {
    return createKeyEngine(options.method, { stackKey: options.stackKey });
  }

  /** The text before the caret, or nothing when part of the text is selected. */
  const textBefore = (): string =>
    field.selectionStart !== null && field.selectionStart === field.selectionEnd
      ? field.value.slice(0, field.selectionStart)
      : '';

  const onKeyDown = (event: KeyboardEvent): void => {
    if (composing || event.isComposing || event.defaultPrevented) return;
    if (event.key === 'Unidentified' || event.keyCode === 229) return;
    const action = engine.handle(event, textBefore());
    if (action.type === 'arm') event.preventDefault();
    else if (
      action.type === 'insert' &&
      insertAtCaret(field, action.text, action.replace)
    )
      event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent): void => {
    if (composing || options.method !== 'win-innwa') return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    // Pasted Latin-1 glyph codes are kept as they are; pasted Unicode Burmese would show as
    // Burmese letters in a font that draws glyph codes, so it becomes glyph codes.
    if (!BURMESE.test(text)) return;
    const converted = switchMethod(text, 'unicode', 'win-innwa');
    if (!insertAtCaret(field, converted.raw)) return;
    event.preventDefault();
    options.onPasteConverted?.(converted.notes);
  };

  const reset = (): void => engine.reset();
  const onCompositionStart = (): void => {
    composing = true;
    engine.reset();
  };
  const onCompositionEnd = (): void => {
    composing = false;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('paste', onPaste);
  target.addEventListener('blur', reset);
  target.addEventListener('pointerdown', reset);
  target.addEventListener('compositionstart', onCompositionStart);
  target.addEventListener('compositionend', onCompositionEnd);

  return {
    update(next) {
      options = { ...options, ...next };
      engine = build();
    },
    detach() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('paste', onPaste);
      target.removeEventListener('blur', reset);
      target.removeEventListener('pointerdown', reset);
      target.removeEventListener('compositionstart', onCompositionStart);
      target.removeEventListener('compositionend', onCompositionEnd);
    },
  };
}
