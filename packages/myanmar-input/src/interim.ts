// INTERIM canonicalizer. Delete this file when @winmetta/pali-text ships a tolerant canonicalizer
// that reports fixes (docs/myanmar-input.md section 7). resolve.ts imports `canonicalize` from here
// and from nowhere else, so removing it is a one-line change.
//
// A TypeScript port of canonicalize_myanmar_syllables in winmetta/pali-myanmar-dictionaries
// (src/pali_myanmar_dicts/normalize.py), checked against golden vectors generated from the Python
// function (interim.vectors.json), plus the typing mistakes the Python side does not cover: a
// leading ေ typed before its consonant, and zero-width characters. Each step records a fix code.

import type { Fix } from './methods.ts';

export interface Canonicalized {
  text: string;
  fixes: Fix[];
}

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD]/g;

// Combining-mark rank within one syllable (UTN #11, NFC order), as in the Python MARK_RANK.
const RANK: Readonly<Record<string, number>> = {
  '\u103B': 1, // ျ
  '\u103C': 2, // ြ
  '\u103D': 3, // ွ
  '\u103E': 4, // ှ
  '\u1031': 5, // ေ
  '\u102D': 6, // ိ
  '\u102E': 6, // ီ
  '\u102F': 7, // ု
  '\u1030': 7, // ူ
  '\u1032': 8, // ဲ
  '\u102B': 9, // ါ
  '\u102C': 9, // ာ
  '\u1036': 10, // ံ
  '\u1037': 11, // ့
  '\u103A': 12, // ်
  '\u1038': 13, // း
};

// A ေ with no consonant or medial before it is typed in visual order: move it after the consonant
// (and its stack and medials). The same pattern marks Zawgyi text (zawgyi.ts).
const LEADING_E =
  // eslint-disable-next-line no-misleading-character-class -- marks are matched as plain code points
  /(?<![\u1000-\u1021\u103B-\u103E\u1039])\u1031([\u1000-\u1021](?:\u1039[\u1000-\u1021\u1050-\u1055])*[\u103B-\u103E]*)/g;

// ဥ before ါ ာ ေ ္ ် ှ is a glyph confusion for ဉ.
const MISUSED_U =
  /\u1025(?=[\u102B\u102C\u1031\u1039\u103A\u103E]|\u1037\u103A)/g;

// A stack (virama and consonant) typed after medials or vowels belongs right after its base. The mark
// class leaves out the asat so a kinzi (င်္) is never taken apart.
const STACK_AFTER_MARKS =
  /([\u102B-\u1038\u103B-\u103E]+)((?:\u1039[\u1000-\u1021\u1050-\u1055])+)/g;

// Either a kinzi, or a base letter with its stacks and two or more marks to put in order.
const CLUSTER_OR_KINZI =
  /\u1004\u103A\u1039|([\u1000-\u102A\u103F\u104E\u1050-\u1055](?:\u1039[\u1000-\u1021\u1050-\u1055])*)([\u102B-\u1032\u1036-\u1038\u103A-\u103E]{2,})/g;

function rank(ch: string): number {
  return RANK[ch] ?? 99;
}

/** Puts one text's syllables in canonical order and says what it fixed. Input is not trusted. */
export function canonicalize(input: string): Canonicalized {
  const fixes = new Set<Fix>();
  let text = input;

  const unJoined = text.replace(ZERO_WIDTH, '');
  if (unJoined !== text) fixes.add('removed-zero-width');
  text = unJoined.normalize('NFC');

  const eMoved = text.replace(LEADING_E, '$1\u1031');
  if (eMoved !== text) fixes.add('moved-e');
  text = eMoved;

  const nya = text.replace(MISUSED_U, '\u1009');
  if (nya !== text) fixes.add('merged-nya-u');
  text = nya;

  for (;;) {
    const swapped = text.replace(STACK_AFTER_MARKS, '$2$1');
    if (swapped === text) break;
    fixes.add('moved-stack');
    text = swapped;
  }

  text = text.replace(
    CLUSTER_OR_KINZI,
    (whole: string, base?: string, marks?: string) => {
      if (base === undefined || marks === undefined) return whole;
      const deduped: string[] = [];
      for (const ch of marks)
        if (!deduped.includes(ch) || ch === '\u103A') deduped.push(ch);
      if (deduped.length !== marks.length) fixes.add('removed-duplicate-marks');
      const ordered = [...deduped].sort((a, b) => rank(a) - rank(b));
      if (ordered.join('') !== deduped.join('')) fixes.add('reordered-marks');
      return base + ordered.join('');
    },
  );

  return { text: text.normalize('NFC'), fixes: [...fixes] };
}
