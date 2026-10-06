import { describe, expect, it } from 'vitest';
import { allClasses } from './classes';
import { allTeachers } from './teachers';

describe('classes.json', () => {
  it('has unique ids and known teachers', () => {
    expect(new Set(allClasses.map((c) => c.id)).size).toBe(allClasses.length);
    const ids = new Set(allTeachers.map((t) => t.id));
    for (const record of allClasses)
      if (record.teacherId) expect(ids.has(record.teacherId)).toBe(true);
  });
  it('has seven active classes, two archived, two study groups', () => {
    const count = (kind: string, status: string) =>
      allClasses.filter((c) => c.kind === kind && c.status === status).length;
    expect(count('class', 'active')).toBe(7);
    expect(count('class', 'archived')).toBe(2);
    expect(count('study-group', 'active')).toBe(2);
  });
  it('shows the public passcode on every active class', () => {
    for (const record of allClasses.filter((c) => c.status === 'active'))
      expect(record.publicPasscode).toBe('metta');
  });
  it('contains no contact details or form links', () => {
    expect(JSON.stringify(allClasses)).not.toMatch(
      /@[a-z0-9-]+\.[a-z]{2,}|docs\.google\.com|forms\.gle|viber|\+?\d{3}[-. ]\d{3}[-. ]\d{4}/i,
    );
  });
});
