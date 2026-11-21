import { z } from 'zod';

/** One line of `state/<bookId>.jsonl` (docs/book-search.md §4). */
export const pageRecordSchema = z.object({
  v: z.literal(1),
  bookId: z.string().min(1),
  /** S3 key from the manifest, kept so ids can be remapped if the key changes. */
  key: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  page: z.number().int().min(1),
  method: z.enum(['text', 'ocr']),
  engine: z.string().min(1),
  extractorVersion: z.number().int().min(1),
  /** ok: indexed; suspect: indexed but low confidence; failed: nothing indexed. */
  status: z.enum(['ok', 'suspect', 'failed']),
  /** Mean word confidence for OCR pages; null for text-layer pages. */
  confidence: z.number().min(0).max(1).nullable(),
  /** Why the text layer was rejected, or why the page is flagged (for example `low_confidence`). */
  reasons: z.array(z.string()),
  passages: z.array(
    z.object({
      ordinal: z.number().int().min(1),
      script: z.enum(['my', 'latn', 'mixed']),
      text: z.string().min(1),
    }),
  ),
  extractedAt: z.iso.datetime(),
});

export type PageRecord = z.infer<typeof pageRecordSchema>;
