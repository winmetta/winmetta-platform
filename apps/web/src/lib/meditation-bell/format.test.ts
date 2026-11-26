import { describe, expect, it } from 'vitest';
import { dayName, format12Hour, formatCountdown } from './format';

describe('formatCountdown', () => {
  it('uses mm:ss and widens to mmm:ss from 100 minutes', () => {
    expect(formatCountdown(9 * 60_000)).toBe('09:00');
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(120 * 60_000)).toBe('120:00');
    expect(formatCountdown(960 * 60_000)).toBe('960:00');
  });
  it('rounds up to the next second and never goes below zero', () => {
    expect(formatCountdown(59_001)).toBe('01:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });
  it('keeps the full fractional display through second and minute boundaries', () => {
    expect(formatCountdown(59_001, true)).toBe('00:59.001');
    expect(formatCountdown(60_000, true)).toBe('01:00.000');
    expect(formatCountdown(120 * 60_000 + 999, true)).toBe('120:00.999');
    expect(formatCountdown(-2, true)).toBe('00:00.000');
  });
});

describe('format12Hour', () => {
  it('writes 12-hour times with Western digits', () => {
    expect(format12Hour('06:00')).toBe('6:00 AM');
    expect(format12Hour('00:05')).toBe('12:05 AM');
    expect(format12Hour('12:30')).toBe('12:30 PM');
    expect(format12Hour('23:59')).toBe('11:59 PM');
  });
});

describe('dayName', () => {
  it('gives the three lengths', () => {
    expect(dayName('Mon')).toBe('Monday');
    expect(dayName('Wed', 'short')).toBe('Wed');
    expect(dayName('Sun', 'narrow')).toBe('Su');
  });
});
