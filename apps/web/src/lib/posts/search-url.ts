// The posts search query lives in the address (?q=…) beside the "Read in" languages
// (?lang=en,zh), so a reload, the Back button and the interface language switch keep both.
// Unlike the library's writeState, this changes only `q` and keeps every other parameter.
import { parseLangParam, withLangParam } from './languages.ts';

export const readQuery = (search: string): string =>
  new URLSearchParams(search).get('q') ?? '';

/** The address with `q` set (or removed when blank); `lang` stays unescaped (`en,zh`). */
export function withQuery(href: string, query: string): string {
  const url = new URL(href);
  const langs = parseLangParam(url.searchParams.get('lang'));
  url.searchParams.delete('lang');
  if (query.trim()) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  return langs.length > 0 ? withLangParam(url.href, langs) : url.href;
}
