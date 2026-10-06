import type { APIRoute, GetStaticPaths } from 'astro';
import { libraryData } from '../../lib/library-data';

export const getStaticPaths = (() => [
  { params: { version: libraryData.version } },
]) satisfies GetStaticPaths;
export const GET: APIRoute = () =>
  new Response(libraryData.indexJson, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
