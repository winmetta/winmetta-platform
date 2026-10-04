import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LibrarySearch,
  SearchHit,
  SearchRecord,
} from '../lib/library-search';
import { fileUrl, languageOf } from '../lib/library-index';
import { normalizeSearch } from '../lib/normalize';
import { formatSize, readState, writeState } from '../lib/library-url';
import { Button } from './ui/button';

export interface Labels {
  searchLabel: string;
  searchPlaceholder: string;
  searchLoading: string;
  searchError: string;
  searchRetry: string;
  results: string;
  similarBooks: string;
  noExact: string;
  noResults: string;
  tryFolders: string;
  resetSearch: string;
  folder: string;
  removeFolder: string;
  download: string;
  showMore: string;
}
interface Props {
  labels: Labels;
  indexUrl: string;
  recordsUrl: string;
  cdnBase: string;
  formatLocale: string;
}
type Status = 'idle' | 'loading' | 'ready' | 'error';
const PAGE = 50;

// The search code, the index and the record list download on first use (focus, typing, or a
// shared link that already has ?q=), never on a plain page view.
interface Engine {
  search: LibrarySearch;
  records: SearchRecord[];
}

function Card({
  record,
  labels,
  cdnBase,
  formatLocale,
  onTag,
}: {
  record: SearchRecord;
  labels: Labels;
  cdnBase: string;
  formatLocale: string;
  onTag: (tag: string) => void;
}) {
  return (
    <li className="space-y-2 rounded-md border border-input bg-background p-4">
      <h3 className="font-medium" lang={record.language}>
        {record.title}
        {record.titleNote ? (
          <span className="font-normal"> ({record.titleNote})</span>
        ) : null}
      </h3>
      <ul className="flex flex-wrap gap-2" aria-label={labels.folder}>
        {record.tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              lang={languageOf(tag)}
              className="min-h-11 rounded-md bg-muted px-3 py-1 text-sm underline"
              onClick={() => onTag(tag)}
            >
              {tag}
            </button>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-4 text-sm">
        <a
          className="inline-flex min-h-11 items-center underline"
          href={fileUrl(cdnBase, record.key)}
          aria-label={`${labels.download}: ${record.title}`}
          rel="noopener"
        >
          {labels.download}
        </a>
        <span>{formatSize(record.sizeBytes, formatLocale)}</span>
      </p>
    </li>
  );
}

export default function LibrarySearchIsland({
  labels,
  indexUrl,
  recordsUrl,
  cdnBase,
  formatLocale,
}: Props) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [visible, setVisible] = useState(PAGE);
  const engine = useRef<Engine | null>(null);
  const started = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  // Bumped when the engine finishes loading, so results are computed once it is ready.
  const [ready, setReady] = useState(0);

  const load = useCallback(async () => {
    if (engine.current || started.current) return;
    started.current = true;
    setStatus('loading');
    try {
      const [module, indexText, records] = await Promise.all([
        import('../lib/library-search'),
        fetch(indexUrl).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        }),
        fetch(recordsUrl).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<SearchRecord[]>;
        }),
      ]);
      engine.current = {
        search: module.LibrarySearch.load(records, indexText),
        records,
      };
      setStatus('ready');
      setReady((n) => n + 1);
    } catch {
      started.current = false;
      setStatus('error');
    }
  }, [indexUrl, recordsUrl]);

  // Restore the state from the URL after hydration (a shared link, back/forward).
  useEffect(() => {
    const apply = () => {
      const state = readState(window.location.search);
      setQuery(state.q);
      setTag(state.tag);
      if (state.q || state.tag) void load();
    };
    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [load]);

  const update = (next: { q?: string; tag?: string }) => {
    const state = { q: next.q ?? query, tag: next.tag ?? tag };
    setQuery(state.q);
    setTag(state.tag);
    setVisible(PAGE);
    window.history.replaceState(null, '', writeState(state, window.location));
  };

  const active = query.trim() !== '' || tag !== '';
  const { exact, similar } = useMemo(() => {
    const loaded = engine.current;
    const none = { exact: [] as SearchHit[], similar: [] as SearchHit[] };
    if (!loaded || !active) return none;
    if (query.trim())
      return loaded.search.search(query, { ...(tag ? { tag } : {}) });
    const wanted = normalizeSearch(tag);
    return {
      exact: loaded.records
        .filter((r) => r.tags.some((t) => normalizeSearch(t) === wanted))
        .map((record) => ({ record, tier: 3, score: 0, similarity: 1 })),
      similar: [] as SearchHit[],
    };
  }, [active, query, tag, ready]);
  const suggestions = [
    ...new Set(similar.slice(0, 5).flatMap((hit) => hit.record.tags)),
  ].slice(0, 6);
  const card = (hit: SearchHit) => (
    <Card
      key={hit.record.id}
      record={hit.record}
      labels={labels}
      cdnBase={cdnBase}
      formatLocale={formatLocale}
      onTag={(t) => update({ tag: t })}
    />
  );

  return (
    <section className="space-y-4" aria-busy={status === 'loading'}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grow space-y-1">
          <span className="block font-medium">{labels.searchLabel}</span>
          <input
            ref={input}
            type="search"
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            value={query}
            placeholder={labels.searchPlaceholder}
            autoComplete="off"
            onFocus={() => void load()}
            onChange={(event) => {
              void load();
              update({ q: event.target.value });
            }}
          />
        </label>
        {active ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              update({ q: '', tag: '' });
              input.current?.focus();
            }}
          >
            {labels.resetSearch}
          </Button>
        ) : null}
      </div>

      {tag ? (
        <p className="flex flex-wrap items-center gap-2">
          <span>{labels.folder}:</span>
          <span
            lang={languageOf(tag)}
            className="rounded-md bg-muted px-3 py-1"
          >
            {tag}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => update({ tag: '' })}
          >
            {labels.removeFolder}
          </Button>
        </p>
      ) : null}

      <div role="status" aria-live="polite">
        {status === 'loading' ? <p>{labels.searchLoading}</p> : null}
        {status === 'ready' && active ? (
          <p>
            {labels.results}:{' '}
            {new Intl.NumberFormat(formatLocale).format(exact.length)}
          </p>
        ) : null}
      </div>

      {status === 'error' ? (
        <p role="alert" className="space-x-3">
          <span>{labels.searchError}</span>
          <Button type="button" onClick={() => void load()}>
            {labels.searchRetry}
          </Button>
        </p>
      ) : null}

      {status === 'ready' && active && exact.length === 0 ? (
        <p>{similar.length ? labels.noExact : labels.noResults}</p>
      ) : null}

      {exact.length > 0 ? (
        <>
          <h2 className="text-xl font-bold">{labels.results}</h2>
          <ul className="space-y-3">{exact.slice(0, visible).map(card)}</ul>
          {exact.length > visible ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisible(visible + PAGE)}
            >
              {labels.showMore}
            </Button>
          ) : null}
        </>
      ) : null}

      {similar.length > 0 ? (
        <>
          <h2 className="text-xl font-bold">{labels.similarBooks}</h2>
          <ul className="space-y-3">{similar.map(card)}</ul>
        </>
      ) : null}

      {exact.length === 0 && suggestions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{labels.tryFolders}</h2>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  lang={languageOf(suggestion)}
                  className="min-h-11 rounded-md bg-muted px-3 py-1 underline"
                  onClick={() => update({ tag: suggestion })}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
