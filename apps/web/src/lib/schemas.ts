import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const language = text.refine((value) => {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}, 'Use a BCP 47 language tag');
const url = z
  .url()
  .refine(
    (value) => ['https:', 'http:'].includes(new URL(value).protocol),
    'Use an HTTP(S) URL',
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => DateTime.fromISO(value).isValid, 'Invalid date');
const display = z.object({ title: text, description: text });
const translations = z
  .record(language, display)
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one translation required',
  );
const editorial = z.object({
  id,
  sourceLanguage: language,
  translations,
  sourceUrl: url,
  verifiedAt: date,
});
function hasSource(value: z.infer<typeof editorial>): boolean {
  return value.translations[value.sourceLanguage] !== undefined;
}
export const pageSchema = editorial
  .extend({ pageId: id })
  .refine(hasSource, 'Source translation required');
export const categorySchema = editorial.refine(
  hasSource,
  'Source translation required',
);
export const resourceTypes = [
  'book',
  'pdf',
  'app',
  'audio',
  'video',
  'image',
  'slides',
  'blog',
  'link',
] as const;
export const resourceSchema = editorial
  .extend({
    type: z.enum(resourceTypes),
    categories: z.array(id).min(1),
    languages: z.array(language).min(1),
    authors: z.array(text).default([]),
    tags: z.array(text).default([]),
    links: z
      .array(
        z.object({
          url,
          label: text,
          format: text.optional(),
          mimeType: text.optional(),
          sizeBytes: z.number().int().nonnegative().optional(),
          platform: z
            .enum(['web', 'android', 'ios', 'windows', 'macos', 'linux'])
            .optional(),
        }),
      )
      .min(1),
  })
  .refine(hasSource, 'Source translation required');
export const recurrenceSchema = z.object({
  timezone: text.refine(
    (value) => IANAZone.isValidZone(value),
    'Use an IANA timezone',
  ),
  weekday: z.number().int().min(1).max(7), // ISO Monday=1, Sunday=7
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});
export const classSlotSchema = recurrenceSchema.extend({
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});
const meetingId = z.string().regex(/^\d{3} \d{4} \d{4}$/);
export const linkKinds = [
  'recordings',
  'teacher',
  'course',
  'reading',
] as const;
export const classSchema = editorial
  .extend({
    kind: z.enum(['class', 'study-group']),
    teacherId: id.optional(),
    languages: z.array(language).min(1),
    status: z.enum(['active', 'archived']),
    recurrences: z.array(classSlotSchema).default([]),
    meetingId: meetingId.optional(),
    joinUrl: url.optional(),
    publicPasscode: text.optional(),
    streamed: z.boolean().default(false),
    links: z.array(z.object({ kind: z.enum(linkKinds), url })).default([]),
    curriculum: z.enum(['llb', 'pgtp']).optional(),
  })
  .refine(hasSource, 'Source translation required')
  .refine(
    (value) =>
      value.status === 'archived'
        ? value.recurrences.length === 0 &&
          !value.meetingId &&
          !value.joinUrl &&
          !value.publicPasscode
        : value.recurrences.length > 0,
    'Active classes need a weekly slot; archived classes must not carry schedule or meeting details',
  )
  .refine(
    (value) => !value.streamed || value.kind === 'class',
    'Only classes are live-streamed',
  );
export type ClassRecord = z.infer<typeof classSchema>;
export type ClassSlot = z.infer<typeof classSlotSchema>;

const localized = z.record(language, text);
const hasLanguage = (value: Record<string, unknown>, lang: string): boolean =>
  value[lang] !== undefined;
export const teacherSchema = z
  .object({
    id,
    sourceLanguage: language,
    names: localized,
    place: localized.optional(),
    photo: text.optional(),
    bio: z.record(
      language,
      z.object({
        sections: z
          .array(
            z.object({
              heading: text.optional(),
              paragraphs: z.array(text).min(1),
            }),
          )
          .min(1),
        // Draft translations show a visible note until a Burmese speaker marks them reviewed.
        reviewed: z.boolean(),
      }),
    ),
    bioSourceUrl: url,
    sourceUrl: url,
    verifiedAt: date,
  })
  .refine(
    (value) =>
      hasLanguage(value.names, value.sourceLanguage) &&
      hasLanguage(value.bio, value.sourceLanguage),
    'Name and biography in the source language are required',
  );
export type Teacher = z.infer<typeof teacherSchema>;

export const channelsSchema = z.object({ youtube: url, facebook: url });

export const retreatSchema = z
  .object({
    id,
    status: z.enum(['past', 'upcoming']),
    format: z.enum(['online', 'onsite', 'hybrid']),
    days: z.number().int().min(1).max(31),
    startDate: date,
    endDate: date,
    timezone: text.refine((value) => IANAZone.isValidZone(value)),
    teacherIds: z.array(id).min(1),
    languages: z.array(language).min(1),
    sourceLanguage: language,
    translations: translations,
    series: z.string().optional(),
    venue: z
      .object({
        name: localized,
        city: text,
        address: text.optional(),
        mapUrl: url.optional(),
      })
      .optional(),
    bannerImage: text.optional(),
    sessions: z
      .array(
        z.object({
          day: z.number().int().min(0).max(31),
          part: z.enum(['opening', 'morning', 'evening', 'closing', 'other']),
          title: text,
          youtubeUrl: url.optional(),
          postUrl: url.optional(),
        }),
      )
      .default([]),
    timetables: z.array(z.object({ label: text, url })).default([]),
    notes: z.array(z.object({ label: text, url })).default([]),
    playlistUrl: url.optional(),
    sourceUrl: url,
    verifiedAt: date,
  })
  .refine((value) => value.endDate >= value.startDate, 'End before start')
  .refine(
    (value) => value.format === 'online' || value.venue !== undefined,
    'Onsite and hybrid retreats need a venue',
  )
  .refine(
    (value) => hasLanguage(value.translations, value.sourceLanguage),
    'Source translation required',
  );
export type Retreat = z.infer<typeof retreatSchema>;

// Generated from the S3 bucket by scripts/generate-library-manifest.mjs.
export const libraryFileSchema = z.object({
  id,
  key: text,
  title: text,
  titleNote: text.optional(),
  tags: z.array(text),
  tagPath: z.array(text),
  language,
  sizeBytes: z.number().int().nonnegative(),
  format: z.literal('pdf'),
  lastModified: z.iso.datetime(),
});
// One folder of the S3 bucket. The id is assigned once by the generator and then kept, so folder
// page URLs survive a folder being renamed (update `path` by hand). `path` is the exact key prefix.
export const folderEntrySchema = z.object({
  id: z.string().regex(/^f[0-9]{3,}$/),
  path: text,
});
export type FolderEntry = z.infer<typeof folderEntrySchema>;
export type LibraryFile = z.infer<typeof libraryFileSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
