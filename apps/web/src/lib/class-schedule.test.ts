import { describe, expect, it } from 'vitest';
import {
  durationMinutes,
  nextOccurrence,
  slotTimes,
  slotView,
  weekdayName,
} from './class-schedule';

// Sunday Pacific 6:30 PM to 8:00 PM, like the Kumārābhivaṃsa class.
const sunday = {
  timezone: 'America/Los_Angeles',
  weekday: 7,
  time: '18:30',
  endTime: '20:00',
};
const saturdayEvening = { ...sunday, weekday: 6 };

describe('nextOccurrence', () => {
  it('finds the next weekly slot and measures its length', () => {
    expect(durationMinutes(sunday)).toBe(90);
    // Wednesday 2026-10-07 12:00 UTC is still Wednesday in Pacific time.
    const next = nextOccurrence(sunday, new Date('2026-10-07T12:00:00Z'));
    expect(next.start.toISOString()).toBe('2026-10-12T01:30:00.000Z'); // Sun Oct 11, 6:30 PM PDT
    expect(next.end.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect(next.inProgress).toBe(false);
  });
  it('treats a class that is running now as the current occurrence', () => {
    const next = nextOccurrence(sunday, new Date('2026-10-12T02:00:00Z'));
    expect(next.start.toISOString()).toBe('2026-10-12T01:30:00.000Z');
    expect(next.inProgress).toBe(true);
  });
  it('moves to the following week once the class has ended', () => {
    const next = nextOccurrence(sunday, new Date('2026-10-12T03:30:00Z'));
    expect(next.start.toISOString()).toBe('2026-10-19T01:30:00.000Z');
  });
  it('keeps Pacific wall time across the US daylight-saving change', () => {
    // Sunday Oct 25 is still PDT; Sunday Nov 8 is PST (clocks changed on Nov 1).
    const before = nextOccurrence(sunday, new Date('2026-10-21T12:00:00Z'));
    const after = nextOccurrence(sunday, new Date('2026-11-02T12:00:00Z'));
    expect(before.start.toISOString()).toBe('2026-10-26T01:30:00.000Z');
    expect(after.start.toISOString()).toBe('2026-11-09T02:30:00.000Z');
  });
});

describe('slotView', () => {
  it('shows Pacific Saturday evening as Myanmar Sunday and flags the rollover', () => {
    const next = nextOccurrence(
      saturdayEvening,
      new Date('2026-10-07T12:00:00Z'),
    );
    const view = slotView(next, 'en');
    expect(view.pacific.weekday).toBe('Saturday');
    expect(view.pacific.start).toMatch(/6:30\s?PM/);
    expect(view.myanmar.weekday).toBe('Sunday');
    expect(view.myanmar.start).toMatch(/8:00\s?AM/); // PDT to Myanmar is +13:30
    expect(view.rollsOver).toBe(true);
  });
  it('moves the Myanmar time by an hour when US clocks change', () => {
    const summer = slotView(
      nextOccurrence(sunday, new Date('2026-10-07T12:00:00Z')),
      'en',
    );
    const winter = slotView(
      nextOccurrence(sunday, new Date('2026-11-02T12:00:00Z')),
      'en',
    );
    expect(summer.myanmar.start).toMatch(/8:00\s?AM/);
    expect(winter.myanmar.start).toMatch(/9:00\s?AM/);
  });
  it('uses Latin digits in Burmese', () => {
    const view = slotView(
      nextOccurrence(sunday, new Date('2026-10-07T12:00:00Z')),
      'my',
    );
    expect(view.pacific.start).toMatch(/[0-9]/);
    expect(view.pacific.date).not.toMatch(/[၀-၉]/);
  });
});

describe('weekday and time labels', () => {
  it('names weekdays in each locale', () => {
    expect(weekdayName(1, 'en')).toBe('Monday');
    expect(weekdayName(7, 'en')).toBe('Sunday');
    expect(weekdayName(1, 'my')).toMatch(/[က-႟]/);
  });
  it('prints the slot wall time range', () => {
    expect(slotTimes(sunday, 'en')).toMatch(/6:30\s?PM\s–\s8:00\s?PM/);
  });
});
