import { describe, expect, it } from 'vitest';
import {
  bucketChars,
  clear,
  convert,
  copy,
  encodingChange,
  fontChange,
  issue,
  loadError,
  swap,
} from './text-converter-events';

describe('converter events', () => {
  it('buckets lengths at the boundaries', () => {
    const cases: [number, string][] = [
      [1, '1-100'],
      [100, '1-100'],
      [101, '101-1000'],
      [1000, '101-1000'],
      [1001, '1001-10000'],
      [10_000, '1001-10000'],
      [10_001, 'more'],
      [200_000, 'more'],
    ];
    for (const [chars, bucket] of cases)
      expect(bucketChars(chars), String(chars)).toBe(bucket);
  });

  it('carries only encodings, a length bucket and fixed words', () => {
    expect(convert('auto', 'unicode', 42)).toEqual({
      name: 'converter_convert',
      data: { from: 'auto', to: 'unicode', length: '1-100' },
    });
    expect(copy('result', 'zawgyi', 'win-innwa', 5000).data).toEqual({
      box: 'result',
      from: 'zawgyi',
      to: 'win-innwa',
      length: '1001-10000',
    });
    expect(fontChange('zawgyi').data).toEqual({ font: 'zawgyi' });
    expect(encodingChange('to', 'win-innwa').data).toEqual({
      side: 'to',
      value: 'win-innwa',
    });
    expect(issue('choose-source').data).toEqual({ kind: 'choose-source' });
  });

  it('has events without properties', () => {
    for (const event of [swap(), clear(), loadError()])
      expect(event.data).toEqual({});
  });
});
