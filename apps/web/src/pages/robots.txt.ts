import type { APIRoute } from 'astro';
import { allowIndexing } from '../lib/site';

/**
 * Same switch as the noindex meta tag. Crawling stays allowed either way: a `Disallow` would stop crawlers
 * from fetching the pages, so they would never see the `noindex` tag. Only the sitemap depends on the switch.
 */
export const GET: APIRoute = ({ site }) => {
  const lines = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site)}`,
      ]
    : ['User-agent: *', 'Allow: /'];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
