import type { APIRoute } from 'astro';
import { allowIndexing } from '../lib/site';

/** Same switch as the noindex meta tag: crawlers are allowed only when the public build opts in. */
export const GET: APIRoute = ({ site }) => {
  const lines = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site)}`,
      ]
    : ['User-agent: *', 'Disallow: /'];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
