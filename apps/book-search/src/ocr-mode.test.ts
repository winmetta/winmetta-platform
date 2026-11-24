import { describe, expect, it } from 'vitest';
import { parseOcrMode } from './ocr-mode.ts';

describe('parseOcrMode', () => {
  it('defaults to never so Tesseract is not started by accident', () => {
    expect(parseOcrMode(undefined)).toBe('never');
  });

  it('accepts auto and never', () => {
    expect(parseOcrMode('auto')).toBe('auto');
    expect(parseOcrMode('never')).toBe('never');
  });

  it('rejects anything else', () => {
    expect(() => parseOcrMode('always')).toThrow('--ocr must be auto or never');
  });
});
