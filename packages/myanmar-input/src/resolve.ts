import { convert, winInnwaToUnicode } from '@winmetta/myanmar-convert';
import { detectAuto } from './auto.ts';
import { canonicalize } from './canonical.ts';
import type {
  Fix,
  InputMethod,
  InputSource,
  Evidence,
  Note,
} from './methods.ts';

export interface ResolveOptions {
  method: InputMethod;
  /** Keep line breaks. Default false: a line break becomes a space. */
  multiline?: boolean;
  /** Put syllables in canonical order. Default true; ignored by `unicode` (as typed). */
  canonicalize?: boolean;
}

export interface ResolvedInput {
  /** The only value an app should store or send. */
  unicode: string;
  source: InputSource;
  evidence: Evidence;
  fixes: Fix[];
  notes: Note[];
}

const LINE_BREAKS = /\r\n|\r|\n/g;

export function resolveInput(
  raw: string,
  options: ResolveOptions,
): ResolvedInput {
  const text = options.multiline ? raw : raw.replace(LINE_BREAKS, ' ');
  const tidy = options.canonicalize ?? true;

  if (options.method === 'unicode')
    return {
      unicode: text,
      source: 'unicode',
      evidence: 'none',
      fixes: [],
      notes: [],
    };

  if (options.method === 'win-innwa') {
    const converted = winInnwaToUnicode(text);
    const result = tidy
      ? canonicalize(converted)
      : { text: converted, fixes: [] };
    return {
      unicode: result.text,
      source: 'win-innwa',
      evidence: 'none',
      fixes: result.fixes,
      notes: [],
    };
  }

  const verdict = detectAuto(text);
  const fixes: Fix[] = [];
  let unicode = text;
  if (verdict.source === 'zawgyi') {
    unicode = convert(text, 'zawgyi', 'unicode').text;
    fixes.push('zawgyi-converted');
  }
  if (tidy) {
    const result = canonicalize(unicode);
    unicode = result.text;
    fixes.push(...result.fixes);
  }
  return {
    unicode,
    source: verdict.source,
    evidence: verdict.evidence,
    fixes,
    notes: verdict.notes,
  };
}

/**
 * The text in the box converted to what the new method shows. Never lossless for every text:
 * Unicode to Win Innwa reports what it could not draw as notes.
 */
export function switchMethod(
  raw: string,
  from: InputMethod,
  to: InputMethod,
): { raw: string; notes: Note[] } {
  if (from === to) return { raw, notes: [] };
  const notes: Note[] = [];

  let unicode: string;
  if (from === 'win-innwa') unicode = convert(raw, 'win-innwa', 'unicode').text;
  else if (from === 'auto') {
    const resolved = resolveInput(raw, { method: 'auto', multiline: true });
    unicode = resolved.unicode;
    notes.push(...resolved.notes);
  } else unicode = raw;

  if (to !== 'win-innwa') return { raw: unicode, notes };

  const converted = convert(unicode, 'unicode', 'win-innwa');
  for (const note of converted.notes)
    if (note.code === 'unmapped' || note.code === 'latin-in-win-innwa')
      notes.push(note);
  return { raw: converted.text, notes };
}
