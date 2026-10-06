import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allTeachers, teacherBio, teacherName } from './teachers';

describe('teachers.json', () => {
  it('has unique ids and a bio in each teacher source language', () => {
    expect(new Set(allTeachers.map((t) => t.id)).size).toBe(allTeachers.length);
    for (const teacher of allTeachers) {
      expect(
        teacher.bio[teacher.sourceLanguage]?.sections.length,
      ).toBeGreaterThan(0);
    }
  });
  it('points every photo at a file that exists', () => {
    for (const teacher of allTeachers) {
      if (teacher.photo)
        expect(
          existsSync(
            new URL(`../assets/people/${teacher.photo}`, import.meta.url),
          ),
        ).toBe(true);
    }
  });
  it('contains no contact details', () => {
    const text = JSON.stringify(allTeachers);
    expect(text).not.toMatch(
      /@[a-z0-9-]+\.[a-z]{2,}|docs\.google\.com|forms\.gle|viber/i,
    );
  });
  it('marks unreviewed English as a draft and falls back honestly', () => {
    const draft = allTeachers.find((t) => t.bio.en && !t.bio.en.reviewed);
    if (draft) expect(teacherBio(draft, 'en').isDraft).toBe(true);
    for (const teacher of allTeachers) {
      expect(teacherName(teacher, 'en').length).toBeGreaterThan(0);
      expect(teacherBio(teacher, 'my').sections.length).toBeGreaterThan(0);
    }
  });
});
