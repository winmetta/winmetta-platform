export type OcrMode = 'auto' | 'never';

/** `never` (the default) records only pages with a usable text layer and never starts Tesseract. */
export function parseOcrMode(value: string | undefined): OcrMode {
  if (value === undefined) return 'never';
  if (value === 'auto' || value === 'never') return value;
  throw new Error('--ocr must be auto or never');
}
