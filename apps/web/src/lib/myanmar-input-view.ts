// What the shared Burmese field says about a result (docs/myanmar-input.md §4): the labels it needs
// and the notice lines for the fixes and notes the package reported. Pure, so it is unit tested.
import type { Fix, Note } from '@winmetta/myanmar-input';
import type { MessageKey } from '../i18n/messages';

export interface InputLabels {
  method: string;
  auto: string;
  unicode: string;
  winInnwa: string;
  /** Has a {font} placeholder. */
  shownIn: string;
  /** Has a {text} placeholder. */
  using: string;
  keysTitle: string;
  keysStacked: string;
  keysLetters: string;
  keysLigatures: string;
  keysKinzi: string;
  keysPunctuation: string;
  stackHint: string;
  fixes: Record<Fix, string>;
  noteUnsure: string;
  noteSuggestWinInnwa: string;
  /** Has a {chars} placeholder. */
  noteUnmapped: string;
}

export function inputLabels(text: (key: MessageKey) => string): InputLabels {
  return {
    method: text('inputMethodLabel'),
    auto: text('inputMethodAuto'),
    unicode: text('inputMethodUnicode'),
    winInnwa: text('inputMethodWinInnwa'),
    shownIn: text('inputShownIn'),
    using: text('inputUsing'),
    keysTitle: text('inputKeysTitle'),
    keysStacked: text('inputKeysStacked'),
    keysLetters: text('inputKeysLetters'),
    keysLigatures: text('inputKeysLigatures'),
    keysKinzi: text('inputKeysKinzi'),
    keysPunctuation: text('inputKeysPunctuation'),
    stackHint: text('inputStackHint'),
    fixes: {
      'moved-e': text('inputFixMovedE'),
      'reordered-marks': text('inputFixReorderedMarks'),
      'moved-stack': text('inputFixMovedStack'),
      'merged-nya-u': text('inputFixMergedNyaU'),
      'removed-zero-width': text('inputFixRemovedZeroWidth'),
      'removed-duplicate-marks': text('inputFixRemovedDuplicateMarks'),
      'zawgyi-converted': text('inputFixZawgyiConverted'),
    },
    noteUnsure: text('inputNoteUnsure'),
    noteSuggestWinInnwa: text('inputNoteSuggestWinInnwa'),
    noteUnmapped: text('inputNoteUnmapped'),
  };
}

/** One sentence for a note, or nothing for a note the field does not show. */
export function noteText(note: Note, labels: InputLabels): string | null {
  switch (note.code) {
    case 'unsure':
      return labels.noteUnsure;
    case 'suggest-win-innwa':
      return labels.noteSuggestWinInnwa;
    case 'unmapped':
      return labels.noteUnmapped.replace('{chars}', note.chars.join(' '));
    case 'latin-in-win-innwa':
      return null;
  }
}

/** The lines for the status area: what was fixed, then what the reader should know. */
export function noticeLines(
  result: { fixes: readonly Fix[]; notes: readonly Note[] },
  labels: InputLabels,
): string[] {
  const lines = result.fixes.map((fix) => labels.fixes[fix]);
  for (const note of result.notes) {
    const line = noteText(note, labels);
    if (line) lines.push(line);
  }
  return lines;
}
