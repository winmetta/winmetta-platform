import { describe, expect, it } from 'vitest';
import { normalizeSearch } from './normalize';
describe('normalizeSearch', () => {
  it('treats ဥ (U+1025) and ဉ (U+1009) as the same letter', () => {
    expect(normalizeSearch('ဥပဒေ')).toBe(normalizeSearch('ဉပဒေ'));
  });
  it('maps Burmese digits to ASCII digits', () => {
    expect(normalizeSearch('၁၀။ အတွဲ ၂')).toBe('10။ အတွဲ 2');
    expect(normalizeSearch('book 12')).toBe(normalizeSearch('book ၁၂'));
  });
  it('does not fold the letter ဝ into the digit zero', () => {
    expect(normalizeSearch('ဝိနည်း')).toBe('ဝိနည်း');
    expect(normalizeSearch('၀')).toBe('0');
  });
  it('removes zero-width characters and orders marks canonically', () => {
    expect(normalizeSearch('မြန်\u200Bမာ')).toBe(normalizeSearch('မြန်မာ'));
    expect(normalizeSearch('ယ့်')).toBe(normalizeSearch('ယ့်'));
  });
  it('folds Latin diacritics but never Burmese marks', () => {
    expect(normalizeSearch('Pāḷi Tipiṭaka')).toBe('pali tipitaka');
    expect(normalizeSearch('မြန်မာ')).toBe('မြန်မာ');
  });
});
