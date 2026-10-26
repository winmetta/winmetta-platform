import type { APIRoute, GetStaticPaths } from 'astro';
import { postSearchData } from '../../lib/posts/search-data';

export const getStaticPaths = (async () => [
  { params: { version: (await postSearchData()).version } },
]) satisfies GetStaticPaths;
export const GET: APIRoute = async () =>
  new Response((await postSearchData()).indexJson, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
