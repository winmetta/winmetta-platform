import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { buildFixtureIndex } from '../test/fixtureIndex.ts';
import { planPublish } from './publish.ts';

const run = promisify(execFile);

describe('planPublish', () => {
  it('uploads the database and its checksum under releases/', () => {
    expect(planPublish('/x/dist/library-search-2026-11-20-r1.sqlite')).toEqual([
      {
        file: '/x/dist/library-search-2026-11-20-r1.sqlite',
        key: 'releases/library-search-2026-11-20-r1.sqlite',
      },
      {
        file: '/x/dist/library-search-2026-11-20-r1.sqlite.sha256',
        key: 'releases/library-search-2026-11-20-r1.sqlite.sha256',
      },
    ]);
  });
  it('refuses a file that is not a built index', () => {
    expect(() => planPublish('/x/other.sqlite')).toThrow(/not a built index/);
    expect(() => planPublish('/x/library-search-1.sqlite.building')).toThrow(
      /not a built index/,
    );
  });
});

describe('book-search:publish without --yes', () => {
  it('shows what it would do and uploads nothing', async () => {
    const { file } = await buildFixtureIndex();
    const script = new URL('./publish.ts', import.meta.url).pathname;
    // A fake aws on PATH proves nothing is called in a dry run.
    const { stdout } = await run(
      process.execPath,
      [script, '--bucket', 'test-bucket', '--file', file],
      {
        env: { ...process.env, PATH: '/nonexistent' },
      },
    );
    expect(stdout).toContain('Would upload');
    expect(stdout).toContain(
      's3://test-bucket/releases/library-search-2026-11-20-r1.sqlite',
    );
    expect(stdout).toContain('Dry run: nothing was uploaded');
  });
  it('needs a bucket', async () => {
    const script = new URL('./publish.ts', import.meta.url).pathname;
    await expect(run(process.execPath, [script])).rejects.toMatchObject({
      code: 1,
    });
  });
});
