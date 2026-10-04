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
export const classSchema = editorial
  .extend({
    teacher: text,
    languages: z.array(language).min(1),
    status: z.enum(['active', 'paused']),
    recurrence: recurrenceSchema,
    joinUrl: url.optional(),
    publicPasscode: text.optional(),
    resourceIds: z.array(id).default([]),
  })
  .refine(hasSource, 'Source translation required');
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
