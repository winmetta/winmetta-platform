import { describe, expect, it } from 'vitest';
import { filterResources } from './library';
import { resourceSchema, classSchema, pageSchema } from './schemas';
const book = resourceSchema.parse({
  id: 'sample-book',
  sourceLanguage: 'en',
  translations: {
    en: { title: 'Sample Book', description: 'Synthetic description' },
    my: { title: 'မြန်မာစာ နမူနာ', description: 'စမ်းသပ်ရန်သာ' },
  },
  sourceUrl: 'https://example.invalid/book',
  verifiedAt: '2026-09-30',
  type: 'book',
  categories: ['sample'],
  languages: ['my'],
  authors: ['Example Teacher'],
  tags: ['Pāḷi'],
  links: [
    { url: 'https://example.invalid/book.pdf', label: 'PDF', format: 'pdf' },
    { url: 'https://example.invalid/book.html', label: 'HTML' },
  ],
});
describe('basic library filtering', () => {
  it.each([
    'BOOK',
    'synthetic',
    'example teacher',
    'Pāḷi',
    'မြန်မာ',
    'စမ်းသပ်',
    '  sample  ',
  ])('searches all localized metadata: %s', (query) => {
    expect(filterResources([book], { query })).toEqual([book]);
  });
  it('combines filters and treats a PDF book as one book', () => {
    expect(
      filterResources([book], {
        query: 'မြန်မာ',
        type: 'book',
        category: 'sample',
        language: 'my',
      }),
    ).toHaveLength(1);
    expect(filterResources([book], { type: 'pdf' })).toEqual([]);
    expect(filterResources([book], { language: 'en' })).toEqual([]);
    expect(filterResources([book], { category: 'other' })).toEqual([]);
    expect(filterResources([book], { query: 'missing' })).toEqual([]);
  });
  it('ignores zero-width spaces and canonicalizes Burmese mark order', () => {
    const spaced = resourceSchema.parse({
      ...book,
      translations: {
        en: { title: 'Spaced', description: 'Synthetic' },
        my: { title: 'မြန်\u200Bမာ', description: 'ယ\u103A\u1037' },
      },
    });
    // A query without ZWSP matches a field containing one, and the reverse.
    expect(filterResources([spaced], { query: 'မြန်မာ' })).toEqual([spaced]);
    expect(filterResources([book], { query: 'မြန်\u200Bမာ' })).toEqual([book]);
    // U+103A U+1037 and U+1037 U+103A normalize to the same order.
    expect(filterResources([spaced], { query: 'ယ\u1037\u103A' })).toEqual([
      spaced,
    ]);
  });
  it('handles empty input without mutating resources', () => {
    expect(filterResources([], {})).toEqual([]);
    expect(filterResources([book], { query: ' ' })).toEqual([book]);
    expect(book.links).toHaveLength(2);
  });
});
describe('content contracts', () => {
  it('rejects invalid source translations, unsafe links, and invalid verification dates', () => {
    expect(
      resourceSchema.safeParse({ ...book, sourceLanguage: 'fr' }).success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ ...book, sourceUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ ...book, verifiedAt: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ ...book, languages: ['not_a_language'] })
        .success,
    ).toBe(false);
  });
  it('accepts localized pages and class schedules and rejects invalid recurrence', () => {
    expect(pageSchema.safeParse({ ...book, pageId: 'smoke' }).success).toBe(
      true,
    );
    const sample = {
      id: 'sample-class',
      sourceLanguage: 'en',
      translations: { en: { title: 'Sample class', description: 'Synthetic' } },
      sourceUrl: 'https://example.invalid/class',
      verifiedAt: '2026-09-30',
      languages: ['en'],
      kind: 'class',
      status: 'active',
      recurrences: [
        {
          timezone: 'Asia/Yangon',
          weekday: 1,
          time: '09:00',
          endTime: '10:00',
        },
      ],
    };
    expect(classSchema.safeParse(sample).success).toBe(true);
    expect(
      classSchema.safeParse({
        ...sample,
        recurrences: [{ ...sample.recurrences[0], time: '24:00' }],
      }).success,
    ).toBe(false);
    // Active classes need a slot; archived classes must not carry schedule details.
    expect(classSchema.safeParse({ ...sample, recurrences: [] }).success).toBe(
      false,
    );
    expect(
      classSchema.safeParse({ ...sample, status: 'archived' }).success,
    ).toBe(false);
    expect(
      classSchema.safeParse({ ...sample, status: 'archived', recurrences: [] })
        .success,
    ).toBe(true);
    expect(
      classSchema.safeParse({ ...sample, kind: 'study-group', streamed: true })
        .success,
    ).toBe(false);
  });
});
