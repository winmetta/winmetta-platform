import { describe, expect, it } from 'vitest';
import { buildQueries, chunkTerms, indexTerms } from './search-text';

describe('Chinese terms', () => {
  it('indexes every character and every overlapping pair', () => {
    expect(indexTerms('贪欲心')).toEqual(['贪', '欲', '心', '贪欲', '欲心']);
  });
  it('queries one character as itself and longer runs as their pairs', () => {
    expect(chunkTerms('贪')).toEqual(['贪']);
    expect(chunkTerms('贪欲')).toEqual(['贪欲']);
    expect(chunkTerms('有学圣者')).toEqual(['有学', '学圣', '圣者']);
  });
  it('splits Chinese at punctuation and keeps Latin words and Burmese apart', () => {
    expect(indexTerms('贪，欲 Lobha')).toEqual(['贪', '欲', 'lobha']);
    expect(chunkTerms('Lobha贪欲')).toEqual(['lobha', '贪欲']);
    expect(indexTerms('လောဘ 贪')).toEqual(['လော', 'ဘ', 'လောဘ', '贪']);
  });
});

describe('unchanged rules for Latin and Burmese', () => {
  it('keeps whole Latin words, folded and lowercased', () => {
    expect(indexTerms('Pāḷi Terms')).toEqual(['pali', 'terms']);
  });
  it('indexes Burmese as 1-3 syllable n-grams', () => {
    expect(indexTerms('ဓမ္မပဒ')).toEqual([
      'ဓမ္မ',
      'ပ',
      'ဒ',
      'ဓမ္မပ',
      'ပဒ',
      'ဓမ္မပဒ',
    ]);
  });
  it('builds no queries for text with nothing searchable', () => {
    expect(buildQueries('  ')).toBeUndefined();
    expect(buildQueries('—，。')).toBeUndefined();
  });
});
