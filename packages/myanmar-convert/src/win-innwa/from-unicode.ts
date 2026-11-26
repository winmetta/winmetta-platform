// Unicode -> Win Innwa. No JavaScript library does this direction, so it is written here.
//
// Unicode stores a syllable in spoken order (consonant, stack, medials, vowels); Win Innwa stores the
// glyphs in the order they are typed: e and medial ra before the consonant, then the consonant, kinzi,
// stacked consonant, the other medials and the marks. Each syllable is read into its parts, then written
// with the glyph variant that fits its neighbours (glyphs.ts).

import {
  BASE,
  LIGATURE,
  MARK,
  MEDIAL_RA,
  SHORT_BASE,
  STACK,
  STANDALONE,
  WIDE,
} from './glyphs.ts';

const VIRAMA = '္';
const ASAT = '်';
const KINZI = 'င်္';

const isConsonant = (ch: string | undefined) =>
  ch !== undefined && ch >= 'က' && ch <= 'အ';

/** Marks that can follow a base, by Unicode code point. */
const MARKS: Readonly<Record<string, keyof Marks>> = {
  'ျ': 'ya',
  'ြ': 'ra',
  'ွ': 'wa',
  'ှ': 'ha',
  'ေ': 'e',
  'ိ': 'i',
  'ီ': 'ii',
  'ု': 'u',
  'ူ': 'uu',
  'ဲ': 'ai',
  'ာ': 'aa',
  'ါ': 'tallAa',
  'ံ': 'anusvara',
  '့': 'dot',
  'း': 'visarga',
  '်': 'asat',
};

interface Marks {
  ya: boolean;
  ra: boolean;
  wa: boolean;
  ha: boolean;
  e: boolean;
  i: boolean;
  ii: boolean;
  u: boolean;
  uu: boolean;
  ai: boolean;
  aa: boolean;
  tallAa: boolean;
  anusvara: boolean;
  dot: boolean;
  visarga: boolean;
  asat: boolean;
}

interface Syllable {
  base: string;
  kinzi: boolean;
  stacks: string[];
  marks: Marks;
  /** Characters of the syllable that have no Win Innwa form, kept as Unicode. */
  extra: string;
}

export interface WinInnwaResult {
  text: string;
  /** Myanmar characters left as Unicode because Win Innwa has no glyph for them. */
  unmapped: string[];
  /** True when the text has Latin letters or symbols, which a Win Innwa font draws as Burmese. */
  hasLatin: boolean;
}

const noMarks = (): Marks => ({
  ya: false,
  ra: false,
  wa: false,
  ha: false,
  e: false,
  i: false,
  ii: false,
  u: false,
  uu: false,
  ai: false,
  aa: false,
  tallAa: false,
  anusvara: false,
  dot: false,
  visarga: false,
  asat: false,
});

/** Reads one syllable starting at `start`, or returns null if no base starts there. */
function readSyllable(
  text: string,
  start: number,
): { syllable: Syllable; end: number } | null {
  let i = start;
  let kinzi = false;
  if (text.startsWith(KINZI, i) && isConsonant(text[i + 3])) {
    kinzi = true;
    i += KINZI.length;
  }
  const base = text[i];
  if (base === undefined || BASE[base] === undefined) return null;
  i += 1;
  const stacks: string[] = [];
  while (text[i] === VIRAMA && isConsonant(text[i + 1])) {
    stacks.push(text[i + 1] as string);
    i += 2;
  }
  const marks = noMarks();
  let extra = '';
  for (let ch = text[i]; ch !== undefined; ch = text[i]) {
    const mark = MARKS[ch];
    // A mark typed twice is kept once; a second one has no glyph of its own.
    if (mark === undefined || marks[mark]) break;
    // Asat followed by virama starts the kinzi of the next syllable.
    if (ch === ASAT && text[i + 1] === VIRAMA) break;
    marks[mark] = true;
    i += 1;
  }
  // A virama left over (before a letter Win cannot stack, or at the end) is kept as Unicode.
  while (text[i] === VIRAMA) {
    extra += VIRAMA;
    i += 1;
  }
  return { syllable: { base, kinzi, stacks, marks, extra }, end: i };
}

const hasLowerMark = (s: Syllable) =>
  s.stacks.length > 0 ||
  s.marks.ya ||
  s.marks.wa ||
  s.marks.ha ||
  s.marks.u ||
  s.marks.uu;

const hasUpperMark = (s: Syllable) =>
  s.kinzi || s.marks.i || s.marks.ii || s.marks.ai || s.marks.anusvara;

function medialRa(s: Syllable): string {
  const wide = WIDE.has(s.base);
  if (s.marks.wa) return wide ? MEDIAL_RA.wideWa : MEDIAL_RA.narrowWa;
  // No glyph is cut both above and below; above matters more, since an upper vowel would overlap it.
  if (hasUpperMark(s))
    return wide ? MEDIAL_RA.wideUpper : MEDIAL_RA.narrowUpper;
  const lower = s.stacks.length > 0 || s.marks.ya || s.marks.ha;
  if (lower) return wide ? MEDIAL_RA.wideLower : MEDIAL_RA.narrowLower;
  return wide ? MEDIAL_RA.wide : MEDIAL_RA.narrow;
}

function baseAndStacks(s: Syllable, unmapped: string[]): string {
  const [first, ...rest] = s.stacks;
  const ligature = first === undefined ? undefined : LIGATURE[s.base + first];
  let out: string;
  let stacks = s.stacks;
  if (ligature !== undefined) {
    out = ligature;
    stacks = rest;
  } else if (
    s.base === 'ဉ' &&
    s.marks.aa &&
    !s.marks.asat &&
    stacks.length === 0
  ) {
    out = MARK.nyaAa; // ဉာ is one glyph; the aa is written here
  } else {
    // ရ keeps its full height with medial ha (ရှိ is "&Sd"); the other short letters shorten for it.
    const short =
      s.base === 'ရ'
        ? hasLowerMark({ ...s, marks: { ...s.marks, ha: false } })
        : hasLowerMark(s);
    out = (short ? SHORT_BASE[s.base] : undefined) ?? (BASE[s.base] as string);
  }
  if (s.kinzi) out += kinziGlyph(s);
  for (const stack of stacks) {
    const glyph = STACK[stack];
    if (glyph === undefined) {
      unmapped.push(VIRAMA + stack);
      out += VIRAMA + stack;
    } else out += glyph;
  }
  return out;
}

function kinziGlyph(s: Syllable): string {
  if (s.marks.i) return MARK.kinziI;
  if (s.marks.ii) return MARK.kinziIi;
  if (s.marks.anusvara) return MARK.kinziAnusvara;
  return MARK.kinzi;
}

/** Medial ha written as one glyph with u or uu (ှု, ှူ): when it is not part of a ya or wa glyph. */
const haTakesU = (s: Syllable) =>
  s.marks.ha && !s.marks.ya && !(s.marks.wa && !s.marks.ra);

function otherMedials(s: Syllable): string {
  const { ya, ha } = s.marks;
  // Medial ra's glyph includes a medial wa (medialRa), so wa is written here only without ra.
  const wa = s.marks.wa && !s.marks.ra;
  if (ya && wa && ha) return MARK.yaWaHa;
  if (ya && wa) return MARK.yaWa;
  if (ya && ha) return MARK.yaHa;
  if (ya) return s.stacks.length > 0 ? MARK.yaLong : MARK.ya;
  if (wa && ha) return MARK.waHa;
  if (wa) return MARK.wa;
  if (!ha) return '';
  if (haTakesU(s) && s.marks.u) return MARK.haU;
  if (haTakesU(s) && s.marks.uu) return MARK.haUu;
  return MARK.ha;
}

/** i, ii and anusvara above the letter. Kinzi has its own glyphs with i, ii or anusvara (kinziGlyph). */
function upperVowels(s: Syllable): string {
  const m = s.marks;
  if (s.kinzi) {
    // Kinzi took the i, the ii or (with neither) the anusvara.
    return m.anusvara && (m.i || m.ii) ? MARK.anusvara : '';
  }
  if (m.i) return m.anusvara ? MARK.iAnusvara : MARK.i;
  return (m.ii ? MARK.ii : '') + (m.anusvara ? MARK.anusvara : '');
}

/** u and uu, tall when something else hangs below the letter. */
function lowerVowels(s: Syllable): string {
  const m = s.marks;
  if (haTakesU(s)) return ''; // written with medial ha (otherMedials)
  const tall = s.stacks.length > 0 || m.ya || m.wa || m.ra;
  return (
    (m.u ? (tall ? MARK.uTall : MARK.u) : '') +
    (m.uu ? (tall ? MARK.uuTall : MARK.uu) : '')
  );
}

/** aa, asat, dot below and visarga, in the order Win Innwa text types them. */
function finals(s: Syllable): string {
  const m = s.marks;
  let out = '';
  const nyaAaLigature =
    s.base === 'ဉ' && m.aa && !m.asat && s.stacks.length === 0;
  if (m.tallAa) out += m.asat ? MARK.tallAaAsat : MARK.tallAa;
  else if (m.aa && !nyaAaLigature) out += MARK.aa;
  if (m.asat && !m.tallAa) out += MARK.asat;
  if (m.dot) {
    const right = s.base === 'န' || ((m.u || m.uu) && !m.ra) || m.ya;
    out += right ? MARK.dotRight : MARK.dot;
  }
  if (m.visarga) out += MARK.visarga;
  return out;
}

function writeSyllable(s: Syllable, unmapped: string[]): string {
  let out = s.marks.e ? MARK.e : '';
  if (s.marks.ra) out += medialRa(s);
  out += baseAndStacks(s, unmapped);
  out += otherMedials(s) + upperVowels(s) + lowerVowels(s);
  out += (s.marks.ai ? MARK.ai : '') + finals(s);
  if (s.extra) unmapped.push(s.extra);
  return out + s.extra;
}

const MYANMAR = /[က-႟]/;
// Printable ASCII, Latin-1 and the Windows-1252 punctuation (curly quotes, dashes, ellipsis and the
// rest), all of which a Win Innwa font draws as Burmese glyphs (space is safe).
const LATIN =
  /[!-~\u00A1-\u00FF\u0152-\u0192\u02C6\u02DC\u2013-\u203A\u20AC\u2122]/;

/** Converts Unicode Burmese text to Win Innwa. Text that is not Burmese is kept as it is. */
export function unicodeToWinInnwa(text: string): WinInnwaResult {
  const unmapped: string[] = [];
  let hasLatin = false;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const read = readSyllable(text, i);
    if (read) {
      out += writeSyllable(read.syllable, unmapped);
      i = read.end;
      continue;
    }
    const ch = text[i] as string;
    const standalone = STANDALONE[ch];
    if (standalone !== undefined) out += standalone;
    else {
      if (MYANMAR.test(ch)) unmapped.push(ch);
      else if (LATIN.test(ch)) hasLatin = true;
      out += ch;
    }
    i += 1;
  }
  return { text: out, unmapped: [...new Set(unmapped)], hasLatin };
}
