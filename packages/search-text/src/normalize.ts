const myanmarDigits = '၀၁၂၃၄၅၆၇၈၉';
// Typed interchangeably in Burmese text: ဥ (U+1025, "u") and ဉ (U+1009, "nya").
// ၀ (digit zero) and ဝ (letter wa) are deliberately NOT folded: that would corrupt real words.
const foldBurmese = (value: string): string =>
  value
    .replace(/ဥ/g, 'ဉ')
    .replace(/[၀-၉]/g, (digit) => String(myanmarDigits.indexOf(digit)));
// Diacritics are stripped from non-Burmese runs only, so `pali` finds `Pāḷi`
// without touching Burmese combining marks.
const foldLatin = (value: string): string =>
  value.replace(/[^က-႟]+/g, (run) =>
    run.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC'),
  );
/**
 * The one normalization shared by the build (index) and queries.
 * NFC also puts U+1037 and U+103A in canonical order. Zero-width characters are
 * invisible break hints often inserted into Burmese text, so they are ignored.
 */
export function normalizeSearch(value: string): string {
  return foldLatin(
    foldBurmese(value.normalize('NFC').replace(/[\u200B-\u200D]/g, '')),
  ).toLowerCase();
}
