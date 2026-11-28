// The lookup contract of the Pāḷi Dictionary (docs/pali-dictionary.md §4). The mock and the real
// service return this shape. Field names follow the dataset's `entries` and `sources` tables
// (winmetta/pali-myanmar-dictionaries plan §3). Like book search, the client checks what it uses and
// treats an unexpected answer as an error.
import { z } from 'zod';

/** A word, not a text, is expected. */
export const MAX_QUERY_CHARS = 64;

export interface LookupRequest {
  /** Canonical Myanmar Unicode, from the input package. The key is applied by whoever answers. */
  q: string;
  /** Restrict to some source ids. */
  sources?: string[];
  limit?: number;
  cursor?: string;
}

const entrySchema = z.object({
  sourceId: z.string().min(1),
  pos: z.string().optional(),
  etymology: z.string().optional(),
  definitionText: z.string(),
  volumeCode: z.string().optional(),
  printedPage: z.number().int().positive().optional(),
  quality: z.enum(['proofed', 'ocr']),
  licenseId: z.string().min(1),
});

const sourceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  author: z.string().optional(),
  year: z.number().int().optional(),
  licenseId: z.string().min(1),
  /** The attribution a licence requires, shown under the answer. */
  attribution: z.string().optional(),
});

const responseSchema = z.object({
  v: z.literal(1),
  q: z.string(),
  keyVersion: z.number().int(),
  via: z.enum(['cdn', 'api', 'mock']),
  matchKind: z.enum(['exact', 'loose', 'prefix', 'none']),
  groups: z.array(
    z.object({
      headword: z.string().min(1),
      headwordIast: z.string().optional(),
      entries: z.array(entrySchema).min(1),
    }),
  ),
  related: z.array(z.string()),
  sources: z.array(sourceSchema),
  mock: z.boolean(),
});

export type Entry = z.infer<typeof entrySchema>;
export type SourceMeta = z.infer<typeof sourceSchema>;
export type LookupResponse = z.infer<typeof responseSchema>;
export type MatchKind = LookupResponse['matchKind'];
export type Via = LookupResponse['via'];

/** What can go wrong, as the fixed words the page and the events use. */
export type IssueKind = 'error' | 'too-long' | 'key-mismatch';

export class LookupError extends Error {
  constructor(readonly kind: IssueKind) {
    super(`lookup failed: ${kind}`);
  }
}

/** Checks an answer from any backend; anything unexpected is an `error`. */
export function parseLookupResponse(data: unknown): LookupResponse {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new LookupError('error');
  return parsed.data;
}
