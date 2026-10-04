import { describe, expect, it } from 'vitest';
import { allRetreats, retreatItem } from './retreats';
import { allTeachers } from './teachers';
import {
  emptyState,
  filterRetreats,
  readState,
  writeState,
} from './retreat-filter';

describe('retreats.json', () => {
  it('has unique ids, known teachers and ordered dates', () => {
    expect(new Set(allRetreats.map((r) => r.id)).size).toBe(allRetreats.length);
    const ids = new Set(allTeachers.map((t) => t.id));
    for (const retreat of allRetreats) {
      for (const id of retreat.teacherIds) expect(ids.has(id)).toBe(true);
      expect(retreat.endDate >= retreat.startDate).toBe(true);
    }
  });
  it('lists the 13 Mettānanda retreats plus the Kovida and Kuṇḍadhāna ones', () => {
    expect(
      allRetreats.filter((r) => r.teacherIds.includes('ghositabhivamsa')),
    ).toHaveLength(13);
    expect(allRetreats).toHaveLength(15);
  });
  it('contains no contact details, forms, spreadsheets or chat invites', () => {
    expect(JSON.stringify(allRetreats)).not.toMatch(
      /@[a-z0-9-]+\.[a-z]{2,}|docs\.google\.com|forms\.gle|viber|bit\.ly|tinyurl|\+?\d{3}[-. ]\d{3}[-. ]\d{4}/i,
    );
  });
});

describe('retreat search', () => {
  const items = allRetreats.map((r) => retreatItem(r, 'en'));
  it('filters by year, format and length', () => {
    expect(
      filterRetreats(items, { ...emptyState, year: '2025' }).length,
    ).toBeGreaterThan(1);
    expect(filterRetreats(items, { ...emptyState, days: '3' })).toHaveLength(1);
    expect(
      filterRetreats(items, { ...emptyState, format: 'online' }).every(
        (i) => i.format === 'online',
      ),
    ).toBe(true);
  });
  it('finds by English and Burmese teacher names and by place', () => {
    expect(filterRetreats(items, { ...emptyState, q: 'kovida' })).toHaveLength(
      1,
    );
    expect(filterRetreats(items, { ...emptyState, q: 'ကောဝိဒ' })).toHaveLength(
      1,
    );
    expect(filterRetreats(items, { ...emptyState, q: 'fremont' })).toHaveLength(
      1,
    );
    expect(filterRetreats(items, { ...emptyState, q: 'zzzz' })).toHaveLength(0);
  });
  it('round-trips state through the URL', () => {
    const state = { ...emptyState, q: 'kovida', year: '2024' };
    const url = writeState(state, { pathname: '/en/retreats/', hash: '' });
    expect(url).toBe('/en/retreats/?q=kovida&year=2024');
    expect(readState(url.split('?')[1] ? `?${url.split('?')[1]}` : '')).toEqual(
      state,
    );
  });
});

describe('retreat session days', () => {
  const sessionDay = (retreatId: string, urlPart: string) =>
    allRetreats
      .find((r) => r.id === retreatId)
      ?.sessions.find((s) =>
        decodeURIComponent(s.postUrl ?? '').includes(urlPart),
      )?.day;

  it('does not take the day from the WordPress post date (8th retreat)', () => {
    // These recordings were published on 28 May but belong to days 2 and 3 (27 and 28 May).
    expect(
      sessionDay('ghositabhivamsa-08-2023-05', '8th-retreat-morning-class-12'),
    ).toBe(2);
    expect(
      sessionDay('ghositabhivamsa-08-2023-05', '8th-retreat-evening-class-2'),
    ).toBe(2);
    expect(
      sessionDay('ghositabhivamsa-08-2023-05', '8th-retreat-morning-class-13'),
    ).toBe(3);
    expect(
      sessionDay('ghositabhivamsa-08-2023-05', '8th-retreat-evening-class-3'),
    ).toBe(3);
  });
  it('keeps the 5th retreat evening series on the right days', () => {
    expect(
      sessionDay(
        'ghositabhivamsa-05-2022-04',
        '5th-zoom-online-10-days-meditation-retreat-evening-4',
      ),
    ).toBe(4);
    expect(
      sessionDay(
        'ghositabhivamsa-05-2022-04',
        'meditation-retreat-evening-2-5',
      ),
    ).toBe(10);
  });
  it('has at most one morning and one evening session per day, within the retreat length', () => {
    for (const retreat of allRetreats) {
      const seen = new Set<string>();
      for (const session of retreat.sessions) {
        expect(session.day).toBeGreaterThanOrEqual(1);
        expect(session.day).toBeLessThanOrEqual(retreat.days);
        if (session.part !== 'morning' && session.part !== 'evening') continue;
        const key = `${session.day}-${session.part}`;
        expect(seen.has(key), `${retreat.id} ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });
});
