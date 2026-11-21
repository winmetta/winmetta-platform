import { describe, expect, it } from 'vitest';
import {
  MAX_PASSAGE_CHARS,
  ocrPassages,
  scriptOf,
  textParagraphs,
} from './text.ts';

describe('scriptOf', () => {
  it('names the script of a passage', () => {
    expect(scriptOf('ဓမ္မ ဒေသနာ')).toBe('my');
    expect(scriptOf('Dhamma 12')).toBe('latn');
    expect(scriptOf('ဓမ္မ Dhamma')).toBe('mixed');
    expect(scriptOf('1234')).toBe('latn');
  });
});

describe('textParagraphs', () => {
  it('splits at blank lines, joins wrapped lines and removes zero-width characters', () => {
    const page = 'First line\nwraps here.\n\n   \nSecond\u200B paragraph.\n';
    expect(textParagraphs(page)).toEqual([
      'First line wraps here.',
      'Second paragraph.',
    ]);
  });
  it('is empty for a blank page', () => {
    expect(textParagraphs(' \n\n \n')).toEqual([]);
  });
  it('cuts a very long block at a sentence end or space, losing no text', () => {
    const sentence = 'ဓမ္မ ဒေသနာ။ ';
    const block = sentence.repeat(400);
    const parts = textParagraphs(block);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts)
      expect([...part].length).toBeLessThanOrEqual(MAX_PASSAGE_CHARS);
    expect(parts.join(' ').replace(/\s/g, '')).toBe(block.replace(/\s/g, ''));
  });
});

describe('ocrPassages', () => {
  it('drops empty paragraphs and normalizes spacing', () => {
    expect(ocrPassages(['  a   b ', '', 'c'])).toEqual(['a b', 'c']);
  });
});
