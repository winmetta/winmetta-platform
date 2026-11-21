import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { handleRequest } from '../../../apps/book-search/src/api/handler.ts';
import {
  openIndex,
  type OpenedIndex,
} from '../../../apps/book-search/src/api/search.ts';

export interface Deps {
  /** Bytes of an object in the index bucket. */
  getObject: (key: string) => Promise<Uint8Array>;
  /** Folder for the downloaded index (Lambda's /tmp). */
  tmpDir: string;
  mount?: string;
  /** Prefix of the released files, such as `releases`. */
  version: string;
  cdnBase: string;
  log?: (line: string) => void;
}

interface FunctionUrlEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string } };
}

/**
 * The book-search Lambda: loads the released SQLite index from the private bucket once per
 * container (from the mount or a checksum-verified download), then answers requests with the shared
 * `handleRequest`. Logs say whether the index loaded, never a query or a request path.
 */
export function createHandler(deps: Deps) {
  const log = deps.log ?? (() => {});
  let loading: Promise<OpenedIndex | undefined> | undefined;

  function openRelease(file: string, immutable = false): OpenedIndex {
    const index = openIndex(file, { immutable });
    if (index.indexVersion === deps.version) return index;
    index.db.close();
    throw new Error('the index metadata does not match the configured release');
  }

  async function load(): Promise<OpenedIndex | undefined> {
    const name = `library-search-${deps.version}.sqlite`;
    try {
      if (deps.mount) {
        const file = path.join(deps.mount, name);
        const sidecar = await readFile(`${file}.sha256`, 'utf8');
        if (!/^[a-f0-9]{64}\s/.test(sidecar))
          throw new Error(
            'the mounted release checksum is missing or malformed',
          );
        const index = openRelease(file, true);
        log(`loaded mounted index ${index.indexVersion}`);
        return index;
      }
      await mkdir(deps.tmpDir, { recursive: true });
      const file = path.join(deps.tmpDir, name);
      const data = await deps.getObject(`releases/${name}`);
      const expected = new TextDecoder()
        .decode(await deps.getObject(`releases/${name}.sha256`))
        .split(/\s+/)[0];
      const actual = createHash('sha256').update(data).digest('hex');
      if (expected !== actual)
        throw new Error('the downloaded index does not match its .sha256');
      await writeFile(file, data);
      const index = openRelease(file);
      log(`loaded index ${index.indexVersion} (${data.length} bytes)`);
      return index;
    } catch (error) {
      log(
        `index load failed: ${error instanceof Error ? error.name : 'error'}`,
      );
      if (!deps.mount) await rm(path.join(deps.tmpDir, name), { force: true });
      return undefined;
    }
  }

  return async function handler(event: FunctionUrlEvent) {
    // A failed load is not cached for good: the next request tries again.
    loading ??= load().then((index) => {
      if (!index) loading = undefined;
      return index;
    });
    const index = await loading;
    const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
    const response = handleRequest(
      {
        method: event.requestContext?.http?.method ?? 'GET',
        url: `${event.rawPath ?? '/'}${query}`,
        headers: event.headers ?? {},
      },
      { index, cdnBase: deps.cdnBase },
    );
    return {
      statusCode: response.status,
      headers: response.headers,
      body: JSON.stringify(response.body),
    };
  };
}
