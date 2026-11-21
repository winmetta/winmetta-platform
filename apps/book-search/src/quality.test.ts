import { describe, expect, it } from 'vitest';
import { checkTextLayer } from './quality.ts';

const burmese = 'ဓမ္မ ဒေသနာ သီလ သမာဓိ ပညာ '.repeat(3);
const english =
  'The teacher explained the four noble truths to the class. '.repeat(2);

describe('checkTextLayer', () => {
  it('accepts a Burmese page in a Burmese book', () => {
    expect(checkTextLayer(burmese, 'my')).toEqual({
      usable: true,
      reasons: [],
    });
  });
  it('accepts an English page, also inside a Burmese book', () => {
    expect(checkTextLayer(english, 'en').usable).toBe(true);
    expect(checkTextLayer(english, 'my').usable).toBe(true);
  });
  it('sends blank pages and lone page numbers to OCR', () => {
    expect(checkTextLayer('', 'my').reasons).toEqual(['too_little_text']);
    expect(checkTextLayer('  \n 12 \n', 'en').reasons).toEqual([
      'too_little_text',
    ]);
  });
  it('rejects Zawgyi text: vowel sign before its consonant', () => {
    const zawgyi = `${burmese} ေက ေသ ေဆ`;
    expect(checkTextLayer(zawgyi, 'my')).toEqual({
      usable: false,
      reasons: ['zawgyi'],
    });
  });
  it('rejects Zawgyi glyph-only code points', () => {
    expect(checkTextLayer(`${burmese} ၠၡၢ`, 'my').reasons).toEqual(['zawgyi']);
  });
  it('tolerates one stray marker, as a typo', () => {
    expect(checkTextLayer(`${burmese} ေက`, 'my').usable).toBe(true);
  });
  it('rejects private-use characters from legacy fonts', () => {
    const text = `${english} \uE001\uE002\uE003`;
    expect(checkTextLayer(text, 'en').reasons).toEqual(['legacy_font']);
  });
  it('rejects symbol garbage in a Burmese book but not in an English one', () => {
    const garbage = `abcdefghij klmnopqrstu ${'¤¨©¶§±×÷ '.repeat(8)}`;
    expect(checkTextLayer(garbage, 'my').reasons).toEqual(['legacy_font']);
    expect(checkTextLayer(garbage, 'en').usable).toBe(true);
  });
  it('rejects ASCII-mapped legacy-font text in a Burmese book (a real library page)', () => {
    const ascii = "ausmfpf GmG 100 a'guf fwmoef f;xG Gef f; wdkufh pdwf pum;";
    expect(checkTextLayer(ascii, 'my').reasons).toEqual(['legacy_font']);
    // In an English book the same text cannot be told from English: a known gap.
    expect(checkTextLayer(ascii, 'en').usable).toBe(true);
  });
  it('rejects a long page of ASCII-mapped legacy-font text that has a few short words by chance', () => {
    const pieces = [
      'ajrmufajr',
      'tdrf&mjypf',
      'avQmfPfoifh',
      'onf',
      'raumif;aoma<u;',
      'cpD;ywfajr',
      'udkcH&onf',
      'qkdtHhusdusL;',
      'vnf;/',
      'a',
      'jzpfonf/',
      'wdkYrSm',
    ];
    const garbage = Array.from(
      { length: 48 },
      (_, i) => pieces[i % pieces.length],
    ).join(' ');
    expect(checkTextLayer(garbage, 'my').reasons).toEqual(['legacy_font']);
    expect(checkTextLayer(english.repeat(3), 'my').usable).toBe(true);
  });
  it('sends romanized Pali in a Burmese book to OCR (costs time, loses nothing)', () => {
    expect(
      checkTextLayer(
        'Namo tassa bhagavato arahato sammasambuddhassa namo',
        'my',
      ).reasons,
    ).toEqual(['legacy_font']);
  });
  it('can report several reasons at once', () => {
    expect(checkTextLayer('ေက ေသ ေဆ', 'my').reasons).toEqual([
      'too_little_text',
      'zawgyi',
    ]);
  });
});
