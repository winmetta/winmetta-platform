import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { manifestPath, pilotBooksPath } from './config.ts';

/** The manifest fields the indexer needs (the full schema lives in apps/web). */
const bookSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string(),
  language: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type Book = z.infer<typeof bookSchema>;

export async function loadManifest(): Promise<Book[]> {
  const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  return z.array(bookSchema).parse(raw);
}

/** Ids listed in apps/book-search/pilot/books.json, a file added with the pilot (plan §5C step 6). */
export async function loadPilotIds(): Promise<string[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(pilotBooksPath, 'utf8'));
  } catch {
    throw new Error(
      `No pilot list at ${pilotBooksPath} yet; name book ids on the command line instead.`,
    );
  }
  return z
    .object({ books: z.array(z.object({ id: z.string().min(1) })) })
    .parse(raw)
    .books.map((book) => book.id);
}

/** Looks the ids up in the manifest; an unknown id is an error, not a skip. */
export function pickBooks(manifest: Book[], ids: string[]): Book[] {
  const byId = new Map(manifest.map((book) => [book.id, book]));
  return ids.map((id) => {
    const book = byId.get(id);
    if (!book) throw new Error(`Book id ${id} is not in the manifest`);
    return book;
  });
}
