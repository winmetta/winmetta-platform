import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHandler } from './handler.ts';

const client = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 2 });

export const handler = createHandler({
  getObject: async (key) => {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BOOK_SEARCH_BUCKET,
        Key: key,
      }),
    );
    if (!response.Body) throw new Error('empty object');
    return response.Body.transformToByteArray();
  },
  tmpDir: '/tmp/book-search',
  version: process.env.BOOK_SEARCH_INDEX_VERSION ?? '',
  cdnBase:
    process.env.PUBLIC_LIBRARY_CDN_BASE ?? 'https://dhamma-library.b-cdn.net',
  log: (line) => console.log(line),
});
