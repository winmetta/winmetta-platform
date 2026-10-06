import { describe, expect, it } from 'vitest';
import { defaultZone, readZone, writeZone } from './schedule-zones';

describe('schedule zone state', () => {
  it('defaults to Pacific and ignores unknown zones', () => {
    expect(defaultZone).toBe('pacific');
    expect(readZone('')).toBe('pacific');
    expect(readZone('?tz=nowhere')).toBe('pacific');
    expect(readZone('?tz=myanmar')).toBe('myanmar');
  });
  it('keeps other query parameters and drops tz for the default', () => {
    const at = { pathname: '/en/classes/', search: '?x=1', hash: '#schedule' };
    expect(writeZone('europe', at)).toBe('/en/classes/?x=1&tz=europe#schedule');
    expect(writeZone('pacific', { ...at, search: '?tz=europe' })).toBe(
      '/en/classes/#schedule',
    );
  });
});
