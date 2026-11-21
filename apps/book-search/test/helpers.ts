import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Book } from '../src/library.ts';

export const tempDir = (): Promise<string> =>
  mkdtemp(path.join(tmpdir(), 'book-search-test-'));

/** A minimal PDF with one line of Helvetica text per page (ASCII only, text layer included). */
export function buildPdf(pageTexts: string[], fontSize = 14): Buffer {
  const objects: string[] = [];
  const kids = pageTexts.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pageTexts.forEach((text, i) => {
    const escaped = text.replace(/[\\()]/g, (c) => `\\${c}`);
    const stream = `BT /F1 ${fontSize} Tf 72 700 Td (${escaped}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

export async function writePdf(
  dir: string,
  pageTexts: string[],
  name = 'book.pdf',
  fontSize = 14,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, buildPdf(pageTexts, fontSize));
  return file;
}

export const fixtureBook = (language = 'en'): Book => ({
  id: 'aaaaaaaaaaaa',
  key: 'folder/Fixture book.pdf',
  title: 'Fixture book',
  language,
  sizeBytes: 0,
});
