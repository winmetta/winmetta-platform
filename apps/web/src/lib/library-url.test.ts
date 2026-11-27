import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatPages,
  formatSize,
  isSingular,
  readState,
  writeState,
} from './library-url';

describe('library URL state', () => {
  it('reads q and tag, defaulting to empty', () => {
    expect(readState('?q=%E1%80%93&tag=Pali')).toEqual({ q: 'ဓ', tag: 'Pali' });
    expect(readState('')).toEqual({ q: '', tag: '' });
  });
  it('writes only the parameters that are set and keeps path and fragment', () => {
    const where = { pathname: '/my/dhamma-library/', hash: '#results' };
    expect(writeState({ q: 'ဓမ္မပဒ', tag: '' }, where)).toBe(
      '/my/dhamma-library/?q=%E1%80%93%E1%80%99%E1%80%B9%E1%80%99%E1%80%95%E1%80%92#results',
    );
    expect(writeState({ q: '  ', tag: '' }, where)).toBe(
      '/my/dhamma-library/#results',
    );
    const url = writeState({ q: 'a b', tag: 'ဝိနည်း' }, where);
    expect(readState(new URL(url, 'https://example.invalid').search)).toEqual({
      q: 'a b',
      tag: 'ဝိနည်း',
    });
  });
});
describe('formatSize', () => {
  it('uses kilobytes, megabytes and gigabytes', () => {
    expect(formatSize(1516268, 'en-US')).toBe('1.5 MB');
    expect(formatSize(935185, 'en-US')).toBe('935 kB');
    expect(formatSize(2.5e9, 'en-US')).toBe('2.5 GB');
  });
  it('formats in Burmese without throwing', () => {
    expect(formatSize(15631937, 'my-MM').length).toBeGreaterThan(0);
  });
});
describe('formatPages', () => {
  const en = { one: '{count} page', other: '{count} pages' };
  const my = { one: '{count} မျက်နှာ', other: '{count} မျက်နှာ' };
  it('picks one or other and uses the interface digits', () => {
    expect(formatPages(1, 'en-US', en)).toBe('1 page');
    expect(formatPages(1012, 'en-US', en)).toBe('1,012 pages');
    expect(formatPages(427, 'my-MM', my)).toBe('၄၂၇ မျက်နှာ');
  });
});
describe('formatCount', () => {
  it('uses Latin digits in English and Burmese digits in Burmese', () => {
    expect(formatCount(1012, 'en-US')).toBe('1,012');
    expect(formatCount(12, 'my-MM')).toBe('၁၂');
    expect(formatCount(1012, 'my-MM')).toBe('၁,၀၁၂');
  });
  it('writes file sizes with Latin digits in both languages', () => {
    expect(formatSize(11800000, 'en-US')).toMatch(/^11\.8/);
    expect(formatSize(11800000, 'my-MM')).toMatch(/^11\.8/);
  });
});
describe('isSingular', () => {
  it('follows the locale plural rules', () => {
    expect(isSingular(1, 'en-US')).toBe(true);
    expect(isSingular(2, 'en-US')).toBe(false);
    expect(isSingular(0, 'en-US')).toBe(false);
    expect(isSingular(1, 'my-MM')).toBe(false);
  });
});
