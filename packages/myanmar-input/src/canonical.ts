// The one seam through which the package reaches the canonicalizer (docs/myanmar-input.md section 7).
// When @winmetta/pali-text ships a tolerant canonicalizer that reports fixes, this import changes and
// interim.ts is deleted. resolve.ts and the dictionary's key both use it from here.
export { canonicalize } from './interim.ts';
export type { Canonicalized } from './interim.ts';
