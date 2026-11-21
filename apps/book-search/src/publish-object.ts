import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Upload } from './publish.ts';
import { run } from './tools.ts';

const PART_BYTES = 64 * 1024 * 1024;
const MULTIPART_THRESHOLD = 256 * 1024 * 1024;

export async function publishObject(
  bucket: string,
  upload: Upload,
  size: number,
  sha256: string,
): Promise<void> {
  const args = ['--bucket', bucket, '--key', upload.key];
  const stored = await run('aws', [
    's3api',
    'head-object',
    ...args,
    '--query',
    'Metadata.sha256',
    '--output',
    'text',
  ]).catch((error: unknown) => {
    if (error instanceof Error && /\(404\)/.test(error.message))
      return undefined;
    throw error;
  });
  if (stored?.stdout.trim() === sha256) return;
  if (stored)
    throw new Error(
      `Release key already exists with a different checksum: ${upload.key}`,
    );

  const metadata = ['--metadata', `sha256=${sha256}`];
  if (size < MULTIPART_THRESHOLD) {
    await run('aws', [
      's3api',
      'put-object',
      ...args,
      ...metadata,
      '--body',
      upload.file,
      '--if-none-match',
      '*',
      '--checksum-sha256',
      Buffer.from(sha256, 'hex').toString('base64'),
    ]);
    return;
  }
  await publishMultipart(upload.file, args, metadata, size);
}

async function publishMultipart(
  file: string,
  args: string[],
  metadata: string[],
  size: number,
): Promise<void> {
  const scratch = await mkdtemp(path.join(path.dirname(file), '.upload-'));
  let uploadId = '';
  try {
    const started = await run('aws', [
      's3api',
      'create-multipart-upload',
      ...args,
      ...metadata,
      '--checksum-algorithm',
      'SHA256',
      '--query',
      'UploadId',
      '--output',
      'text',
    ]);
    uploadId = started.stdout.trim();
    const multipart = [...args, '--upload-id', uploadId];
    const parts = await uploadParts(file, size, scratch, multipart);
    const manifest = path.join(scratch, 'parts.json');
    await writeFile(manifest, JSON.stringify({ Parts: parts }));
    await run('aws', [
      's3api',
      'complete-multipart-upload',
      ...multipart,
      '--if-none-match',
      '*',
      '--multipart-upload',
      `file://${manifest}`,
    ]);
  } catch (error) {
    if (uploadId) {
      await run('aws', [
        's3api',
        'abort-multipart-upload',
        ...args,
        '--upload-id',
        uploadId,
      ]).catch((abortError: unknown) =>
        console.error('Could not abort multipart upload:', abortError),
      );
    }
    throw error;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

interface Part {
  PartNumber: number;
  ETag: string;
  ChecksumSHA256: string;
}

async function uploadParts(
  file: string,
  size: number,
  scratch: string,
  multipart: string[],
): Promise<Part[]> {
  const partFile = path.join(scratch, 'part');
  const partBytes = Math.max(PART_BYTES, Math.ceil(size / 10_000));
  const parts: Part[] = [];
  for (let start = 0; start < size; start += partBytes) {
    const end = Math.min(size, start + partBytes) - 1;
    await writeFile(partFile, createReadStream(file, { start, end }));
    const PartNumber = parts.length + 1;
    const { stdout } = await run('aws', [
      's3api',
      'upload-part',
      ...multipart,
      '--part-number',
      String(PartNumber),
      '--body',
      partFile,
      '--checksum-algorithm',
      'SHA256',
      '--output',
      'json',
    ]);
    const result = JSON.parse(stdout) as Partial<Part>;
    if (!result.ETag || !result.ChecksumSHA256)
      throw new Error(
        `S3 did not return the checksum and ETag for part ${PartNumber}`,
      );
    parts.push({
      PartNumber,
      ETag: result.ETag,
      ChecksumSHA256: result.ChecksumSHA256,
    });
  }
  return parts;
}
