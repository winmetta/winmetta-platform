// The Win Innwa dead key and the keys tray (docs/myanmar-input.md section 5). In Win Innwa a key types
// its own glyph code, so a plain English keyboard cannot type a stacked Pāḷi consonant. Shift+F is the
// dead key: press it, then the key of the consonant to stack. The key sequences follow pndaza's Keyman
// "smart" Win Innwa layout (see NOTICE); they are facts about which key gives which glyph, no code is
// copied. The table is checked against the converter in keys.test.ts so the two cannot drift.

import type { InputMethod } from './methods.ts';

/** The part of a DOM KeyboardEvent the engine reads, so tests and other callers need no DOM. */
export interface KeyEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * - `insert`: type `text` in place of the `replace` characters before the caret; the key is consumed.
 * - `arm`: the dead key was pressed; the key is consumed, nothing is typed.
 * - `cancel`: the dead key is dropped and the key is typed as it normally would be.
 * - `pass`: not ours; the key is typed as it normally would be.
 */
export type KeyAction =
  | { type: 'insert'; text: string; replace: number }
  | { type: 'arm' }
  | { type: 'cancel' }
  | { type: 'pass' };

export interface KeyEngine {
  /** `before` is the text before the caret, for ligatures and kinzi. */
  handle(event: KeyEvent, before?: string): KeyAction;
  /** Drops a pending dead key: call it when the caret moves or the box loses focus. */
  reset(): void;
  readonly armed: boolean;
}

export interface KeyEngineOptions {
  /** Shift+F stacks and `ff` is kinzi. Default true. */
  stackKey?: boolean;
}

// Key after Shift+F -> stacked glyph. The comment is the consonant.
const STACK_KEYS: Readonly<Record<string, string>> = {
  u: 'ú', // က
  c: '©', // ခ
  '*': '¾', // ဂ
  C: '¢', // ဃ
  '#': '³', // ဋ
  X: '²', // ဌ
  p: 'ö', // စ
  q: 'ä', // ဆ
  Z: 'Æ', // ဇ
  Q: 'Ñ', // ဈ
  w: 'å', // တ
  x: '¬', // ထ
  "'": '´', // ဒ
  '"': '¨', // ဓ
  e: 'é', // န
  P: 'Ö', // ဏ
  y: 'Ü', // ပ
  z: 'æ', // ဖ
  A: 'Á', // ဗ
  b: 'Ç', // ဘ
  r: '®', // မ
  v: '’', // လ
};

// Glyph before the caret -> key after Shift+F -> ligature that replaces it.
const LIGATURE_KEYS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  '#': { '#': '¥', X: '|' }, // ဋ္ဋ ဋ္ဌ
  '!': { '!': '×', B: '¹' }, // ဍ္ဍ ဍ္ဎ
  P: { '!': '@' }, // ဏ္ဍ
};

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'Dead',
  'Process',
]);

const PASS: KeyAction = { type: 'pass' };
const ARM: KeyAction = { type: 'arm' };
const CANCEL: KeyAction = { type: 'cancel' };

const insert = (text: string, replace: number): KeyAction => ({
  type: 'insert',
  text,
  replace,
});

/** Dead keys act only in Win Innwa; every other method gets an engine that passes every key. */
export function createKeyEngine(
  method: InputMethod,
  options: KeyEngineOptions = {},
): KeyEngine {
  const active = method === 'win-innwa';
  const stackKey = options.stackKey ?? true;
  let armed = false;

  return {
    get armed() {
      return armed;
    },
    reset() {
      armed = false;
    },
    handle(event, before = '') {
      if (!active || !stackKey) return PASS;
      if (event.ctrlKey || event.altKey || event.metaKey) {
        const wasArmed = armed;
        armed = false;
        return wasArmed ? CANCEL : PASS;
      }
      if (MODIFIER_KEYS.has(event.key)) return PASS;

      if (armed) {
        armed = false;
        const ligature = LIGATURE_KEYS[before.slice(-1)]?.[event.key];
        if (ligature !== undefined) return insert(ligature, 1);
        const stacked = STACK_KEYS[event.key];
        if (stacked !== undefined) return insert(stacked, 0);
        return CANCEL;
      }
      if (event.key === 'F' && event.shiftKey) {
        armed = true;
        return ARM;
      }
      // Kinzi: `f` is asat, and a second `f` turns it into the kinzi glyph.
      if (event.key === 'f' && !event.shiftKey && before.endsWith('f'))
        return insert('F', 1);
      return PASS;
    },
  };
}

export type KeyKind = 'stack' | 'letter' | 'ligature' | 'kinzi';

export interface TrayKey {
  kind: KeyKind;
  unicode: string;
  winInnwa: string;
  /** What to insert for the chosen method: Win Innwa glyph codes in Win Innwa, Unicode otherwise. */
  insert: string;
}

export interface KeyGroup {
  id: 'stacked' | 'independent' | 'ligatures' | 'kinzi' | 'punctuation';
  keys: TrayKey[];
}

const VIRAMA = '္';

// Consonant stacked by each key, in the order the tray shows them.
const STACKED: readonly [consonant: string, key: string][] = [
  ['က', 'u'],
  ['ခ', 'c'],
  ['ဂ', '*'],
  ['ဃ', 'C'],
  ['စ', 'p'],
  ['ဆ', 'q'],
  ['ဇ', 'Z'],
  ['ဈ', 'Q'],
  ['ဋ', '#'],
  ['ဌ', 'X'],
  ['တ', 'w'],
  ['ထ', 'x'],
  ['ဒ', "'"],
  ['ဓ', '"'],
  ['န', 'e'],
  ['ဏ', 'P'],
  ['ပ', 'y'],
  ['ဖ', 'z'],
  ['ဗ', 'A'],
  ['ဘ', 'b'],
  ['မ', 'r'],
  ['လ', 'v'],
];

// Extra letters Pāḷi needs: the Unicode letter and the Win Innwa key that types it.
const LETTERS: readonly [unicode: string, winInnwa: string][] = [
  ['ဋ', '#'],
  ['ဌ', 'X'],
  ['ဍ', '!'],
  ['ဎ', '¡'],
  ['ဏ', 'P'],
  ['ဥ', 'O'],
  ['ဉ', 'Ú'],
  ['ဿ', 'ó'],
];

const LIGATURES: readonly [unicode: string, winInnwa: string][] = [
  ['ဋ္ဋ', '¥'],
  ['ဋ္ဌ', '|'],
  ['ဍ္ဍ', '×'],
  ['ဍ္ဎ', '¹'],
  ['ဏ္ဍ', '@'],
];

const PUNCTUATION: readonly [unicode: string, winInnwa: string][] = [
  ['၊', '?'],
  ['။', '/'],
];

/** The Pāḷi keys tray as data: the page draws it and calls `insert` for the chosen method. */
export function keyGroups(method: InputMethod): KeyGroup[] {
  const win = method === 'win-innwa';
  const key = (kind: KeyKind, unicode: string, winInnwa: string): TrayKey => ({
    kind,
    unicode,
    winInnwa,
    insert: win ? winInnwa : unicode,
  });
  return [
    {
      id: 'stacked',
      keys: STACKED.map(([consonant, k]) =>
        key('stack', VIRAMA + consonant, STACK_KEYS[k] ?? ''),
      ),
    },
    {
      id: 'independent',
      keys: LETTERS.map(([u, w]) => key('letter', u, w)),
    },
    {
      id: 'ligatures',
      keys: LIGATURES.map(([u, w]) => key('ligature', u, w)),
    },
    { id: 'kinzi', keys: [key('kinzi', 'င်္', 'F')] },
    {
      id: 'punctuation',
      keys: PUNCTUATION.map(([u, w]) => key('letter', u, w)),
    },
  ];
}
