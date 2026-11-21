import { realpath } from 'node:fs/promises';
import { run } from './tools.ts';

export interface OcrParagraph {
  text: string;
  /** Mean word confidence, 0 to 1. */
  confidence: number;
}

/**
 * Paragraphs from Tesseract's TSV output: level 5 rows are words, grouped by block and
 * paragraph number; a row with conf -1 is not a word.
 */
export function parseTsv(tsv: string): OcrParagraph[] {
  if (!tsv.startsWith('level\t'))
    throw new Error('Tesseract did not return TSV output');
  const groups = new Map<string, { words: string[]; confs: number[] }>();
  for (const line of tsv.split('\n').slice(1)) {
    const cells = line.replace(/\r$/, '').split('\t');
    if (cells.length < 12 || cells[0] !== '5') continue;
    const conf = Number(cells[10]);
    const text = cells.slice(11).join('\t').trim();
    if (!text || !(conf >= 0)) continue;
    const key = `${cells[2]}.${cells[3]}`;
    const group = groups.get(key) ?? { words: [], confs: [] };
    group.words.push(text);
    group.confs.push(conf);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ words, confs }) => ({
    text: words.join(' '),
    confidence: confs.reduce((a, b) => a + b, 0) / confs.length / 100,
  }));
}

/** Page confidence: the mean over paragraphs, weighted by word count. */
export function meanConfidence(paragraphs: OcrParagraph[]): number {
  let words = 0;
  let sum = 0;
  for (const p of paragraphs) {
    const n = p.text.split(' ').length;
    words += n;
    sum += p.confidence * n;
  }
  return words ? sum / words : 0;
}

export async function ocrImage(
  image: string,
  options: { tessdataDir: string; langs?: string; timeoutMs?: number },
): Promise<OcrParagraph[]> {
  // Leptonica, inside Tesseract, cannot open some paths that start with /tmp on macOS (`/tmp` is a
  // link to /private/tmp); the resolved path always works.
  const resolved = await realpath(image);
  const { stdout } = await run(
    'tesseract',
    [
      resolved,
      'stdout',
      '--tessdata-dir',
      options.tessdataDir,
      '-l',
      options.langs ?? 'mya+eng',
      '--psm',
      '3',
      // Not the `tsv` config name: the pinned tessdata_best folder has no configs/ directory.
      '-c',
      'tessedit_create_tsv=1',
    ],
    { timeoutMs: options.timeoutMs ?? 5 * 60 * 1000 },
  );
  return parseTsv(stdout);
}
