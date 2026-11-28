import { describe, expect, it } from 'vitest';
import { headwordKey } from './key';
import vectors from './key.vectors.json';

describe('headwordKey', () => {
  // Generated with to_headword_norm in winmetta/pali-myanmar-dictionaries. When @winmetta/pali-text
  // replaces key.ts, these are the acceptance test.
  it.each(vectors)('$input', ({ input, key }) => {
    expect(headwordKey(input)).toBe(key);
  });

  it('makes stacked and unstacked spellings meet', () => {
    expect(headwordKey('ဓမ္မ')).toBe(headwordKey('ဓမမ'));
    // A longer word keeps the shorter key as its start: it is a prefix match, not an exact one.
    expect(headwordKey('ဓမ္မာ').startsWith(headwordKey('ဓမ္မ'))).toBe(true);
    expect(headwordKey('ဓမ္မာ')).not.toBe(headwordKey('ဓမ္မ'));
    expect(headwordKey('သင်္ဃ')).toBe(headwordKey('သံဃ'));
    expect(headwordKey('သဿတ')).toBe(headwordKey('သသသတ'));
    expect(headwordKey('ပဉှ')).toBe(headwordKey('ပဉဟ'));
  });

  it('is idempotent', () => {
    for (const { input } of vectors) {
      const once = headwordKey(input);
      expect(headwordKey(once), input).toBe(once);
    }
  });
});
