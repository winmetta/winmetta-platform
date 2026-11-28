// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Storage {
  data = new Map<string, string>();
  blocked = false;
  getItem(key: string) {
    if (this.blocked) throw new Error('blocked');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.blocked) throw new Error('blocked');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    if (this.blocked) throw new Error('blocked');
    this.data.delete(key);
  }
}

const storage = new Storage();
vi.stubGlobal('localStorage', storage);
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

const {
  clearInputSetting,
  defaultInput,
  inputKey,
  parseInputSetting,
  readInputSetting,
  subscribeInputSetting,
  writeInputSetting,
} = await import('./input-method');

beforeEach(() => {
  storage.blocked = false;
  clearInputSetting();
});
afterEach(() => vi.clearAllMocks());

describe('parseInputSetting', () => {
  it.each([
    [null],
    ['not json'],
    ['{"method":"zawgyi"}'],
    ['{"method":"auto","stackKey":"yes"}'],
    ['[]'],
  ])('is Auto with stacking on for %s', (raw) => {
    expect(parseInputSetting(raw)).toEqual(defaultInput);
  });

  it('reads a valid value and fills a missing field', () => {
    expect(
      parseInputSetting('{"method":"win-innwa","stackKey":false}'),
    ).toEqual({
      method: 'win-innwa',
      stackKey: false,
    });
    expect(parseInputSetting('{"method":"unicode"}')).toEqual({
      method: 'unicode',
      stackKey: true,
    });
  });
});

describe('the store', () => {
  it('saves, reads back and keeps the other field', () => {
    expect(writeInputSetting({ method: 'win-innwa' })).toBe(true);
    expect(writeInputSetting({ stackKey: false })).toBe(true);
    expect(readInputSetting()).toEqual({
      method: 'win-innwa',
      stackKey: false,
    });
    expect(JSON.parse(storage.data.get(inputKey)!)).toEqual({
      method: 'win-innwa',
      stackKey: false,
    });
  });

  it('returns the same object until something changes', () => {
    writeInputSetting({ method: 'unicode' });
    const first = readInputSetting();
    expect(readInputSetting()).toBe(first);
    writeInputSetting({ method: 'unicode' });
    expect(readInputSetting()).toBe(first);
    writeInputSetting({ method: 'auto' });
    expect(readInputSetting()).not.toBe(first);
  });

  it('tells subscribers, and Reset clears the key', () => {
    const listener = vi.fn();
    const stop = subscribeInputSetting(listener);
    writeInputSetting({ method: 'win-innwa' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(clearInputSetting()).toBe(true);
    expect(storage.data.has(inputKey)).toBe(false);
    expect(readInputSetting()).toEqual(defaultInput);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    writeInputSetting({ method: 'auto' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the choice for the page view when storage is blocked', () => {
    storage.blocked = true;
    expect(writeInputSetting({ method: 'win-innwa' })).toBe(false);
    expect(readInputSetting().method).toBe('win-innwa');
    expect(clearInputSetting()).toBe(false);
    expect(readInputSetting()).toEqual(defaultInput);
  });
});
