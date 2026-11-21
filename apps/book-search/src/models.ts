import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** tesseract-ocr/tessdata_best commit the models are pinned to (developer-guide.md §2). */
export const TESSDATA_COMMIT = 'e12c65a915945e4c28e237a9b52bc4a8f39a0cec';

export interface Model {
  lang: string;
  size: number;
  /** Git blob id of the file at TESSDATA_COMMIT (what `git hash-object` prints). */
  blob: string;
}

export const MODELS: Model[] = [
  {
    lang: 'mya',
    size: 14971060,
    blob: '4adbb96ab500fb339f988de33eb8bb5717e8e6a6',
  },
  {
    lang: 'eng',
    size: 15400601,
    blob: '176dc3220de7db34d3b3aecbfa42043a6038348b',
  },
];

export const modelUrl = (lang: string): string =>
  `https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/${TESSDATA_COMMIT}/${lang}.traineddata`;

/** The id `git hash-object` gives a file with this content. */
export const gitBlobId = (data: Uint8Array): string =>
  createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');

export type ModelState = 'ok' | 'missing' | 'mismatch';

export async function verifyModel(
  dir: string,
  model: Model,
): Promise<ModelState> {
  let data: Buffer;
  try {
    data = await readFile(path.join(dir, `${model.lang}.traineddata`));
  } catch {
    return 'missing';
  }
  return data.length === model.size && gitBlobId(data) === model.blob
    ? 'ok'
    : 'mismatch';
}

/** Downloads every model that is missing or wrong and checks its hash before keeping it. */
export async function ensureModels(
  dir: string,
  log: (line: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const model of MODELS) {
    const state = await verifyModel(dir, model);
    if (state === 'ok') {
      log(`${model.lang}: already present, hash ok`);
      continue;
    }
    log(`${model.lang}: ${state}, downloading ${modelUrl(model.lang)}`);
    const response = await fetchImpl(modelUrl(model.lang));
    if (!response.ok)
      throw new Error(
        `${model.lang}: download failed (HTTP ${response.status})`,
      );
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== model.size || gitBlobId(data) !== model.blob)
      throw new Error(
        `${model.lang}: downloaded file does not match the pinned hash; nothing was kept`,
      );
    const target = path.join(dir, `${model.lang}.traineddata`);
    await writeFile(`${target}.part`, data);
    await rename(`${target}.part`, target);
    log(`${model.lang}: saved, hash ok`);
  }
}
