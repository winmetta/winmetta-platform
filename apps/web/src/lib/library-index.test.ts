import { describe, expect, it } from 'vitest';
import {
  duplicateIdentity,
  fileUrl,
  partsFromKey,
  recordFromObject,
  titleFromFilename,
} from './library-index';
import { libraryFileSchema } from './schemas';
describe('partsFromKey', () => {
  it('turns every folder into a tag without its number prefix', () => {
    const parts = partsFromKey('၁၀။ မြန်မာရှား (၁)/၁။ ဝိနိစ္ဆယများ/စာအုပ်.pdf');
    expect(parts.tags).toEqual(['မြန်မာရှား (၁)', 'ဝိနိစ္ဆယများ']);
    expect(parts.filename).toBe('စာအုပ်.pdf');
  });
  it('strips ASCII number prefixes and keeps the rest of the name', () => {
    expect(
      partsFromKey('18. Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ/x.pdf').tags,
    ).toEqual(['Ashin-Kelasa(Arizona)-ရေးပြီးကျမ်းများ']);
  });
  it('ignores zero-width characters and merges same-named folders', () => {
    expect(partsFromKey('၄။​ ပါဠိတော် နိဿယ/a.pdf').tags).toEqual([
      'ပါဠိတော် နိဿယ',
    ]);
    expect(
      partsFromKey('၁၀။ မြန်မာ/၉။ ပါဠိစာပေ/၂၀။ ပါဠိစာပေ/a.pdf').tags,
    ).toEqual(['မြန်မာ', 'ပါဠိစာပေ']);
  });
  it('has no tags for a file in the bucket root', () => {
    expect(partsFromKey('a.pdf').tags).toEqual([]);
  });
});
describe('titleFromFilename', () => {
  it('splits a trailing parenthetical note', () => {
    expect(titleFromFilename('River War II (Winston Churchill).pdf')).toEqual({
      title: 'River War II',
      titleNote: 'Winston Churchill',
    });
    expect(titleFromFilename(' BuddhavamsaAth Tran..pdf')).toEqual({
      title: 'BuddhavamsaAth Tran.',
    });
  });
  it('treats an unclosed parenthesis as a title and note', () => {
    expect(
      titleFromFilename('Digha Nikaya I,II,III (Maurice Walshe.pdf'),
    ).toEqual({ title: 'Digha Nikaya I,II,III', titleNote: 'Maurice Walshe' });
  });
  it('drops a doubled closing parenthesis', () => {
    expect(
      titleFromFilename('History of Buddhism in Ceylon (W. Rahula)).pdf'),
    ).toEqual({
      title: 'History of Buddhism in Ceylon',
      titleNote: 'W. Rahula',
    });
  });
  it('drops a closing parenthesis that has no opening one', () => {
    expect(titleFromFilename('မြန်န်မာသမိုင်းပုံ Dr. သန်းထွန်း).pdf')).toEqual({
      title: 'မြန်န်မာသမိုင်းပုံ Dr. သန်းထွန်း',
    });
  });
  it('drops a dangling opening parenthesis at the end', () => {
    expect(titleFromFilename('အဖြေ (ပခုက္ကူအရှင်ကေလသ(.pdf')).toEqual({
      title: 'အဖြေ',
      titleNote: 'ပခုက္ကူအရှင်ကေလသ',
    });
  });
  it('keeps balanced parentheses untouched', () => {
    expect(titleFromFilename('Name (A) (B).pdf')).toEqual({
      title: 'Name (A)',
      titleNote: 'B',
    });
  });
  it('keeps titles that are only a parenthetical', () => {
    expect(titleFromFilename('(စာ).pdf')).toEqual({ title: '(စာ)' });
  });
});
describe('fileUrl', () => {
  it('encodes each segment and keeps the key exact', () => {
    expect(fileUrl('https://cdn.example.invalid/', '16. JPTS/A (B).pdf')).toBe(
      'https://cdn.example.invalid/16.%20JPTS/A%20(B).pdf',
    );
    expect(fileUrl('https://cdn.example.invalid', 'ပါဠိ/ဂ.pdf')).toContain(
      '%E1%80%95',
    );
  });
});
describe('recordFromObject', () => {
  const object = {
    Key: '၁။ ပါဠိတော်/ဝိနည်း (ဆရာ).pdf',
    Size: 1234,
    LastModified: '2023-06-27T07:06:45+00:00',
  };
  it('builds a schema-valid record', () => {
    const record = recordFromObject(object, 'abc123def456');
    expect(libraryFileSchema.parse(record)).toEqual(record);
    expect(record).toMatchObject({
      title: 'ဝိနည်း',
      titleNote: 'ဆရာ',
      tags: ['ပါဠိတော်'],
      language: 'my',
    });
  });
  it('detects the same file under a differently spelled folder', () => {
    const a = recordFromObject(object, 'a1');
    const b = recordFromObject(
      { ...object, Key: '၁။​ ပါဠိတော်/ဝိနည်း (ဆရာ).pdf' },
      'b2',
    );
    expect(duplicateIdentity(a)).toBe(duplicateIdentity(b));
    expect(duplicateIdentity(a)).not.toBe(
      duplicateIdentity({ ...b, sizeBytes: 5 }),
    );
  });
});
