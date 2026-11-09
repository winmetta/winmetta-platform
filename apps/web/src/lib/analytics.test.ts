import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bucketCount,
  bucketPosition,
  bucketTime,
  cleanPayload,
  doNotTrack,
  sanitizeReferrer,
  scriptOf,
  sectionOf,
  track,
} from './analytics';

const origin = 'https://app.winmetta.org';

describe('buckets', () => {
  it('buckets counts as 0, 1-5, 6-20, more', () => {
    expect([0, 1, 5, 6, 20, 21, 3000].map(bucketCount)).toEqual([
      '0',
      '1-5',
      '1-5',
      '6-20',
      '6-20',
      'more',
      'more',
    ]);
  });
  it('buckets result positions as 1, 2-3, 4-10, more', () => {
    expect([1, 2, 3, 4, 10, 11].map(bucketPosition)).toEqual([
      '1',
      '2-3',
      '2-3',
      '4-10',
      '4-10',
      'more',
    ]);
  });
  it('buckets load times', () => {
    expect([0, 999, 1000, 2999, 3000, 9999, 10000].map(bucketTime)).toEqual([
      'under-1s',
      'under-1s',
      '1-3s',
      '1-3s',
      '3-10s',
      '3-10s',
      'over-10s',
    ]);
  });
});

describe('scriptOf', () => {
  it('labels the script, never the text', () => {
    expect(scriptOf('ဝိနည်း')).toBe('my');
    expect(scriptOf('vinaya')).toBe('latin');
    expect(scriptOf('vinaya ဝိနည်း')).toBe('mixed');
    expect(scriptOf('123')).toBe('other');
  });
});

describe('sectionOf', () => {
  it('returns only known section names', () => {
    expect(sectionOf('/en/classes/whatever/')).toBe('classes');
    expect(sectionOf('/my/dhamma-library/folders/x/')).toBe('dhamma-library');
    expect(sectionOf('/en/secret-person-name/')).toBe('other');
    expect(sectionOf('/classes/')).toBe('classes');
    expect(sectionOf('/')).toBe('other');
  });
});

describe('sanitizeReferrer', () => {
  it('keeps only the origin of an outside referrer', () => {
    expect(
      sanitizeReferrer(
        'https://www.google.com/search?q=my+secret+words',
        origin,
      ),
    ).toBe('https://www.google.com/');
  });
  it('keeps only locale and section of an internal referrer, never a query', () => {
    expect(
      sanitizeReferrer(`${origin}/en/dhamma-library/?q=ဝိနည်း`, origin),
    ).toBe('/en/dhamma-library/');
    expect(sanitizeReferrer('/my/classes/retreats/r1/', origin)).toBe(
      '/my/classes/',
    );
  });
  it('collapses a typed or unknown internal path to /', () => {
    expect(sanitizeReferrer(`${origin}/en/typed-by-a-person/`, origin)).toBe(
      '/',
    );
    expect(sanitizeReferrer(`${origin}/whatever/`, origin)).toBe('/');
  });
  it('drops empty and non-web referrers', () => {
    expect(sanitizeReferrer('', origin)).toBe('');
    expect(
      sanitizeReferrer('android-app://com.google.android.gm', origin),
    ).toBe('');
  });
});

describe('cleanPayload', () => {
  const base = {
    website: 'id',
    screen: '1080x2400',
    url: `${origin}/en/dhamma-library/?q=secret#frag`,
    referrer: 'https://duckduckgo.com/?q=secret',
    title: 'Dhamma Library',
  };
  it('removes screen size, the query string and the fragment', () => {
    const out = cleanPayload(base, origin, false);
    expect(out).not.toHaveProperty('screen');
    expect(out.url).toBe('/en/dhamma-library/');
    expect(out.referrer).toBe('https://duckduckgo.com/');
    expect(JSON.stringify(out)).not.toContain('secret');
  });
  it('reports one constant path for the 404 page', () => {
    const out = cleanPayload(
      { ...base, url: `${origin}/en/some-typed-path/` },
      origin,
      true,
    );
    expect(out.url).toBe('/404/');
    expect(JSON.stringify(out)).not.toContain('typed');
  });
});

describe('doNotTrack', () => {
  it('honors the browser signals', () => {
    expect(doNotTrack({ doNotTrack: '1' })).toBe(true);
    expect(doNotTrack({ msDoNotTrack: '1' })).toBe(true);
    expect(doNotTrack({ windowDoNotTrack: 'yes' })).toBe(true);
    expect(doNotTrack({ doNotTrack: '0' })).toBe(false);
    expect(doNotTrack({ doNotTrack: null })).toBe(false);
  });
});

describe('track', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does nothing when the tracker is not loaded', () => {
    expect(() => track('x', { a: 1 })).not.toThrow();
  });
  it('forwards to umami and never throws', () => {
    const fn = vi.fn();
    vi.stubGlobal('umami', { track: fn });
    track('library_search', { count: '1-5' });
    expect(fn).toHaveBeenCalledWith('library_search', { count: '1-5' });
    vi.stubGlobal('umami', {
      track: () => {
        throw new Error('boom');
      },
    });
    expect(() => track('x')).not.toThrow();
  });
});
