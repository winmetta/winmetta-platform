export type Script = 'my' | 'latn' | 'mixed';

/** Longest passage kept whole; longer blocks are cut at a sentence end or space. */
export const MAX_PASSAGE_CHARS = 1500;

export function scriptOf(text: string): Script {
  const myanmar = /[က-႟]/.test(text);
  const latin = /\p{Script=Latin}/u.test(text);
  return myanmar && latin ? 'mixed' : myanmar ? 'my' : 'latn';
}

const clean = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/[\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function splitLong(text: string): string[] {
  const pieces: string[] = [];
  let rest = text;
  while ([...rest].length > MAX_PASSAGE_CHARS) {
    const head = rest.slice(0, MAX_PASSAGE_CHARS);
    const cut = Math.max(head.lastIndexOf('။'), head.lastIndexOf(' ')) + 1;
    const at = cut > MAX_PASSAGE_CHARS / 2 ? cut : MAX_PASSAGE_CHARS;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** Passages of a text layer page: blank-line blocks, lines joined, long blocks cut. */
export function textParagraphs(pageText: string): string[] {
  return pageText
    .split(/\n[ \t]*\n/)
    .map(clean)
    .filter(Boolean)
    .flatMap(splitLong);
}

/** Passages of an OCR page: its paragraphs as read, long ones cut. */
export const ocrPassages = (paragraphs: string[]): string[] =>
  paragraphs.map(clean).filter(Boolean).flatMap(splitLong);
