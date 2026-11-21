import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openIndex } from './api/search.ts';
import { createApiServer, listen } from './api/server.ts';
import {
  SearchApiError,
  createSearchClient,
  type SearchClient,
} from './client.ts';
import { DEFAULT_BASE_URL, cdnBase, workDir, workPaths } from './config.ts';
import { LANGUAGES, type SearchLanguage } from './contract.ts';

const usage = `Usage:
  npm run book-search -- search "<words>" [--lang any|my|en|pi|und] [--limit 10] [--page 1] [--json]
  npm run book-search -- health [--json]
  npm run book-search:serve -- [--db <file>] [--port 8787]

The search and health commands call the API at --base-url, else BOOK_SEARCH_BASE_URL, else
${DEFAULT_BASE_URL} (the local server). Point the base URL at https://app.winmetta.org to use the
deployed service. \`serve\` starts the local server on the newest built index in the work folder.
`;

async function newestIndex(): Promise<string> {
  const dist = workPaths(workDir()).dist;
  const names = (await readdir(dist).catch(() => [] as string[]))
    .filter((name) => name.endsWith('.sqlite'))
    .sort();
  const newest = names.at(-1);
  if (!newest)
    throw new Error(`No built index in ${dist}; run npm run book-search:build`);
  return path.join(dist, newest);
}

async function serve(values: { db?: string; port?: string }): Promise<number> {
  const file = values.db ?? (await newestIndex());
  const index = openIndex(file, { verifySha: !values.db });
  const server = createApiServer({ index, cdnBase: cdnBase() }, console.log);
  const port = await listen(server, Number(values.port ?? 8787));
  console.log(
    `Serving ${path.basename(file)} (${index.indexVersion}) on http://127.0.0.1:${port}`,
  );
  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => server.close(() => resolve()));
    process.once('SIGTERM', () => server.close(() => resolve()));
  });
  return 0;
}

type Values = {
  lang?: string;
  limit?: string;
  page?: string;
  'base-url'?: string;
  json?: boolean;
};

async function runHealth(
  client: SearchClient,
  values: Values,
): Promise<number> {
  const result = await client.health();
  console.log(
    values.json
      ? JSON.stringify(result)
      : `${result.indexVersion}: ${result.books} books, ${result.pages} pages, ${result.passages} passages`,
  );
  return 0;
}

async function runSearch(
  client: SearchClient,
  words: string[],
  values: Values,
): Promise<number> {
  const q = words.join(' ');
  if (!q) {
    console.error('Give the words to search for.');
    return 1;
  }
  if (values.lang && !(LANGUAGES as readonly string[]).includes(values.lang)) {
    console.error(`--lang must be one of ${LANGUAGES.join(', ')}`);
    return 1;
  }
  const result = await client.search({
    q,
    ...(values.lang ? { lang: values.lang as SearchLanguage } : {}),
    ...(values.limit ? { limit: Number(values.limit) } : {}),
    ...(values.page ? { page: Number(values.page) } : {}),
  });
  if (values.json) {
    console.log(JSON.stringify(result));
    return 0;
  }
  if (result.results.length === 0) console.log('No matches.');
  result.results.forEach((hit, i) => {
    const how = hit.ocr
      ? ` [OCR${hit.confidence === null ? '' : ` ${hit.confidence.toFixed(2)}`}]`
      : '';
    console.log(
      `${i + 1}. ${hit.title} - PDF page ${hit.page}${how}\n   ${hit.snippet}\n   ${hit.pdfUrl}`,
    );
  });
  if (result.hasMore) console.log('(more results: use --page)');
  return 0;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      lang: { type: 'string' },
      limit: { type: 'string' },
      page: { type: 'string' },
      'base-url': { type: 'string' },
      json: { type: 'boolean' },
      db: { type: 'string' },
      port: { type: 'string' },
    },
  });
  const [command, ...rest] = positionals;
  if (command === 'serve') return serve(values);
  if (command !== 'search' && command !== 'health') {
    console.log(usage);
    return command ? 1 : 0;
  }
  const client = createSearchClient({
    baseUrl:
      values['base-url'] ??
      process.env['BOOK_SEARCH_BASE_URL'] ??
      DEFAULT_BASE_URL,
  });
  try {
    return command === 'health'
      ? await runHealth(client, values)
      : await runSearch(client, rest, values);
  } catch (error) {
    if (error instanceof SearchApiError) {
      console.error(`The service answered ${error.status} ${error.code}`);
      return 1;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
