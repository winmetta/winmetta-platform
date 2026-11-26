import { describe, expect, it } from 'vitest';
import { convert, detect } from '@winmetta/myanmar-convert';
import { MAX_CHARS, run, swap } from './text-converter';

const converter = { convert, detect };

describe('run', () => {
  it('has nothing to show for empty text', () => {
    expect(run('', 'auto', 'zawgyi', converter)).toMatchObject({
      output: '',
      source: null,
      issue: null,
    });
  });

  it('refuses text over the size limit', () => {
    const big = 'က'.repeat(MAX_CHARS + 1);
    expect(run(big, 'unicode', 'zawgyi', converter)).toMatchObject({
      output: '',
      issue: 'too-long',
    });
    expect(
      run('က'.repeat(MAX_CHARS), 'unicode', 'unicode', converter).issue,
    ).toBeNull();
  });

  it('finds Zawgyi with Auto and converts it', () => {
    const view = run('ျမန္မာစာ ေလ့လာျခင္း', 'auto', 'unicode', converter);
    expect(view).toMatchObject({
      source: 'zawgyi',
      detected: true,
      output: 'မြန်မာစာ လေ့လာခြင်း',
    });
  });

  it('does not convert Pāḷi by itself: Auto asks the reader to choose', () => {
    // Stacked consonants score as Zawgyi but have no Zawgyi-only pattern.
    expect(
      run('ဓမ္မစက္ကပ္ပဝတ္တနသုတ္တ', 'auto', 'zawgyi', converter),
    ).toMatchObject({
      output: '',
      source: null,
      issue: 'choose-source',
    });
  });

  it('converts Pāḷi when the reader chooses the source', () => {
    expect(
      run('ဓမ္မစက္ကပ္ပဝတ္တနသုတ္တ', 'unicode', 'unicode', converter),
    ).toMatchObject({ same: true, output: 'ဓမ္မစက္ကပ္ပဝတ္တနသုတ္တ' });
  });

  it('passes text with no Burmese through, and says so', () => {
    expect(run('hello', 'auto', 'zawgyi', converter)).toMatchObject({
      noBurmese: true,
      output: 'hello',
    });
  });

  it('converts a chosen Win Innwa source and keeps the notes', () => {
    const view = run('jrefrm', 'win-innwa', 'unicode', converter);
    expect(view.output).toBe('မြန်မာ');
    expect(view.detected).toBe(false);
    const back = run('မြန်မာ Dhamma', 'unicode', 'win-innwa', converter);
    expect(back.notes.map((n) => n.code)).toContain('latin-in-win-innwa');
  });
});

describe('swap', () => {
  it('exchanges two chosen encodings', () => {
    expect(swap('zawgyi', 'unicode', null)).toEqual({
      from: 'unicode',
      to: 'zawgyi',
    });
  });

  it('uses what Auto found, or Unicode when it found nothing', () => {
    expect(swap('auto', 'unicode', 'zawgyi')).toEqual({
      from: 'unicode',
      to: 'zawgyi',
    });
    expect(swap('auto', 'win-innwa', null)).toEqual({
      from: 'win-innwa',
      to: 'unicode',
    });
  });
});
