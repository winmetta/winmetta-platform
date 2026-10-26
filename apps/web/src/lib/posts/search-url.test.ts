import { describe, expect, it } from 'vitest';
import { readQuery, withQuery } from './search-url';

const base = 'https://app.example.invalid/en/dhamma-posts/';

describe('search query in the address', () => {
  it('reads q', () => {
    expect(readQuery('?q=%E8%B4%AA&lang=en')).toBe('贪');
    expect(readQuery('')).toBe('');
  });
  it('sets q and keeps lang unescaped, other parameters and the fragment', () => {
    expect(withQuery(`${base}?lang=en,zh&x=1#top`, 'လောဘ')).toBe(
      `${base}?x=1&q=%E1%80%9C%E1%80%B1%E1%80%AC%E1%80%98&lang=en,zh#top`,
    );
  });
  it('removes q when the box is cleared', () => {
    expect(withQuery(`${base}?q=old&lang=my`, '  ')).toBe(`${base}?lang=my`);
    expect(withQuery(`${base}?q=old`, '')).toBe(base);
  });
});
