import { describe, expect, it } from 'vitest';
import { canonicalize } from './interim.ts';
import vectors from './interim.vectors.json' with { type: 'json' };

describe('canonicalize: golden vectors from the Python function', () => {
  // Generated with canonicalize_myanmar_syllables in winmetta/pali-myanmar-dictionaries. When
  // @winmetta/pali-text replaces interim.ts, these are the acceptance test.
  it.each(vectors)('$input', ({ input, canonical }) => {
    expect(canonicalize(input).text).toBe(canonical);
  });

  it('is idempotent', () => {
    for (const { input } of vectors) {
      const once = canonicalize(input).text;
      expect(canonicalize(once)).toEqual({ text: once, fixes: [] });
    }
  });
});

describe('canonicalize: fixes', () => {
  it.each([
    ['က​ာ', 'ကာ', ['removed-zero-width']],
    ['ေကာ', 'ကော', ['moved-e']],
    ['ေကျ', 'ကျေ', ['moved-e']],
    ['ေဓမ္မ', 'ဓေမ္မ', ['moved-e']],
    ['ကာေြင', 'ကြောင', ['reordered-marks']],
    ['ဥာဏ်', 'ဉာဏ်', ['merged-nya-u']],
    ['ဣနြ္ဒိယ', 'ဣန္ဒြိယ', ['moved-stack']],
    ['ကိိ', 'ကိ', ['removed-duplicate-marks']],
    ['ကေ့်', 'ကေ့်', []],
    ['သင်္ဃ', 'သင်္ဃ', []],
    ['ဓမ္မ', 'ဓမ္မ', []],
    ['hello', 'hello', []],
  ])('%j', (input, text, fixes) => {
    expect(canonicalize(input)).toEqual({ text, fixes });
  });
});
