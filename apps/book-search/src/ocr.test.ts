import { describe, expect, it } from 'vitest';
import { meanConfidence, parseTsv } from './ocr.ts';

const header =
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const row = (
  level: number,
  block: number,
  par: number,
  conf: number,
  text: string,
) => `${level}\t1\t${block}\t${par}\t1\t1\t0\t0\t10\t10\t${conf}\t${text}`;

describe('parseTsv', () => {
  it('groups words into paragraphs by block and paragraph, with mean confidence', () => {
    const tsv = [
      header,
      row(1, 0, 0, -1, ''),
      row(5, 1, 1, 90, 'Dhamma'),
      row(5, 1, 1, 70, 'talk'),
      row(5, 2, 1, 50, 'Second'),
      '',
    ].join('\n');
    expect(parseTsv(tsv)).toEqual([
      { text: 'Dhamma talk', confidence: 0.8 },
      { text: 'Second', confidence: 0.5 },
    ]);
  });
  it('ignores non-word rows, empty words and negative confidence', () => {
    const tsv = [
      header,
      row(4, 1, 1, 80, 'line'),
      row(5, 1, 1, -1, 'x'),
      row(5, 1, 1, 60, ' '),
    ].join('\n');
    expect(parseTsv(tsv)).toEqual([]);
  });
  it('keeps words that contain tabs or Burmese text', () => {
    const tsv = [header, row(5, 1, 1, 95, 'ဓမ္မ')].join('\n');
    expect(parseTsv(tsv)).toEqual([{ text: 'ဓမ္မ', confidence: 0.95 }]);
  });
});

describe('parseTsv input check', () => {
  it('rejects output that is not TSV instead of reporting an empty page', () => {
    expect(() => parseTsv('Dhamma Pali teaching\n')).toThrow(/TSV/);
  });
});

describe('meanConfidence', () => {
  it('weights paragraphs by word count', () => {
    expect(
      meanConfidence([
        { text: 'a b c', confidence: 0.9 },
        { text: 'd', confidence: 0.5 },
      ]),
    ).toBeCloseTo(0.8);
  });
  it('is 0 when there are no words', () => {
    expect(meanConfidence([])).toBe(0);
  });
});
