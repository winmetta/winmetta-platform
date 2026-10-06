// Myanmar syllable segmentation (the well-known "sylbreak" rule): a syllable
// starts at a consonant that is not stacked (after virama U+1039) and not a final
// consonant (before asat U+103A or virama), and at independent vowels, digits and
// Myanmar punctuation. Deterministic on purpose: Intl.Segmenter differs by browser.
const syllableStart = /(?:(?<!္)[က-ဢ](?![်္])|[ဣ-ဧဩဪဿ၀-၏])/g;
export function burmeseSyllables(run: string): string[] {
  const starts = [...run.matchAll(syllableStart)].map((match) => match.index);
  if (starts.length === 0) return run ? [run] : [];
  const cuts = starts[0] === 0 ? starts : [0, ...starts];
  return cuts.map((start, i) => run.slice(start, cuts[i + 1])).filter(Boolean);
}
export interface ScriptRun {
  script: 'my' | 'other';
  text: string;
}
/** Splits text into Burmese runs and everything else (Latin, digits, spaces). */
export function splitScripts(text: string): ScriptRun[] {
  return [...text.matchAll(/[က-႟]+|[^က-႟]+/g)].map((match) => ({
    script: /^[က-႟]/.test(match[0]) ? 'my' : 'other',
    text: match[0],
  }));
}
