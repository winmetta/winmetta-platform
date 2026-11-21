import { useCallback, useEffect, useRef, useState } from 'react';
import { bucketCount, scriptOf, track } from '../lib/analytics';
import {
  citation,
  failureKind,
  parseResponse,
  readPdfQuery,
  searchUrl,
  writePdfQuery,
  type BookHit,
  type FailureKind,
} from '../lib/book-search';
import { formatCount } from '../lib/library-url';
import { Button } from './ui/button';

export interface BookSearchLabels {
  title: string;
  intro: string;
  label: string;
  placeholder: string;
  button: string;
  searching: string;
  noResults: string;
  tooShort: string;
  unavailable: string;
  retry: string;
  /** Contains {page}. */
  page: string;
  ocr: string;
  printedNote: string;
  open: string;
  copy: string;
  copied: string;
  more: string;
  results: string;
}
interface Props {
  labels: BookSearchLabels;
  formatLocale: string;
}
type Status = 'idle' | 'loading' | 'done' | FailureKind;

const pageLabel = (template: string, page: number, formatLocale: string) =>
  template.replace('{page}', formatCount(page, formatLocale));

/** The answer to one request: results, or why there are none. Never throws. */
async function ask(
  q: string,
  page: number,
  signal: AbortSignal,
): Promise<
  | { ok: true; hits: BookHit[]; hasMore: boolean }
  | { ok: false; failure: FailureKind }
> {
  try {
    const response = await fetch(searchUrl(q, page), {
      headers: { accept: 'application/json' },
      signal,
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const code = (body as { error?: { code?: string } } | undefined)?.error
        ?.code;
      return { ok: false, failure: failureKind(response.status, code) };
    }
    const parsed = parseResponse(body);
    return { ok: true, hits: parsed.results, hasMore: parsed.hasMore };
  } catch {
    return { ok: false, failure: 'unavailable' };
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    return done;
  }
}

export default function BookSearchIsland({ labels, formatLocale }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [hits, setHits] = useState<BookHit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState('');
  // The next page failed to load: the pages already shown stay, with a retry for that page.
  const [moreFailed, setMoreFailed] = useState(false);
  const submitted = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string, nextPage: number) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (nextPage === 1) {
      submitted.current = q;
      setStatus('loading');
      setMoreFailed(false);
    }
    const answer = await ask(q, nextPage, abort.signal);
    if (abort.signal.aborted) return;
    if (!answer.ok) {
      if (nextPage > 1) setMoreFailed(true);
      else setStatus(answer.failure);
      return;
    }
    setMoreFailed(false);
    setHits((current) =>
      nextPage === 1 ? answer.hits : [...current, ...answer.hits],
    );
    setHasMore(answer.hasMore);
    setPage(nextPage);
    setStatus('done');
    // Only the number of results as a range and the script of the words, never the words.
    if (nextPage === 1)
      track('book_search', {
        results: bucketCount(answer.hits.length),
        script: scriptOf(q),
      });
  }, []);

  // A shared link with ?pdf=… searches on load.
  useEffect(() => {
    const q = readPdfQuery(window.location.search);
    if (q.trim()) {
      setQuery(q);
      void run(q, 1);
    } else if (input.current?.value) {
      // Text typed before hydration finished is kept, not wiped by the empty first render.
      setQuery(input.current.value);
    }
    return () => controller.current?.abort();
  }, [run]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Read the field itself: it is the truth even if the first render has not caught up yet.
    const q = (input.current?.value ?? query).trim();
    setQuery(q);
    window.history.replaceState(null, '', writePdfQuery(q, window.location));
    if (q) void run(q, 1);
    else {
      controller.current?.abort();
      setStatus('idle');
      setHits([]);
    }
  };

  const onCopy = async (hit: BookHit) => {
    const key = `${hit.bookId}:${hit.page}`;
    track('book_search_result_click', { kind: 'copy' });
    if (
      await copyText(
        citation(hit, pageLabel(labels.page, hit.page, formatLocale)),
      )
    ) {
      setCopied(key);
      setTimeout(() => setCopied((now) => (now === key ? '' : now)), 2500);
    }
  };

  return (
    <section
      className="space-y-4"
      aria-labelledby="book-search-title"
      aria-busy={status === 'loading'}
      data-book-search
    >
      <header className="space-y-2">
        <h2 id="book-search-title" className="text-2xl font-bold">
          {labels.title}
        </h2>
        <p className="muted">{labels.intro}</p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={submit}
        role="search"
      >
        <label className="grow space-y-1">
          <span className="block font-medium">{labels.label}</span>
          <input
            ref={input}
            type="search"
            className="field"
            value={query}
            placeholder={labels.placeholder}
            autoComplete="off"
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button type="submit">{labels.button}</Button>
      </form>

      <div role="status" aria-live="polite">
        {status === 'loading' ? (
          <p className="muted">{labels.searching}</p>
        ) : null}
        {status === 'too_short' ? <p>{labels.tooShort}</p> : null}
        {status === 'done' && hits.length === 0 ? (
          <p>{labels.noResults}</p>
        ) : null}
      </div>
      {status === 'unavailable' ? (
        <p role="alert" className="space-x-3">
          <span>{labels.unavailable}</span>
          <Button
            type="button"
            onClick={() => void run(submitted.current || query.trim(), 1)}
          >
            {labels.retry}
          </Button>
        </p>
      ) : null}

      {hits.length > 0 && status !== 'unavailable' ? (
        <div className="space-y-3">
          <h3 className="text-xl font-bold">{labels.results}</h3>
          <ul className="space-y-3">
            {hits.map((hit) => {
              const key = `${hit.bookId}:${hit.page}`;
              return (
                <li key={key} className="card space-y-3" data-book-hit>
                  <h4 className="text-lg font-semibold" lang={hit.language}>
                    {hit.title}
                  </h4>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="chip" title={labels.printedNote}>
                      {pageLabel(labels.page, hit.page, formatLocale)}
                    </span>
                    {hit.ocr ? (
                      <span className="chip">{labels.ocr}</span>
                    ) : null}
                  </p>
                  <p lang={hit.language}>{hit.snippet}</p>
                  <p className="flex flex-wrap items-center gap-3">
                    <a
                      className="btn btn-primary"
                      href={hit.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        track('book_search_result_click', { kind: 'open' })
                      }
                    >
                      {labels.open}
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onCopy(hit)}
                    >
                      {copied === key ? labels.copied : labels.copy}
                    </Button>
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="muted">{labels.printedNote}</p>
          {moreFailed ? (
            <p role="alert" className="space-x-3">
              <span>{labels.unavailable}</span>
              <Button
                type="button"
                onClick={() => void run(submitted.current, page + 1)}
              >
                {labels.retry}
              </Button>
            </p>
          ) : hasMore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void run(submitted.current, page + 1)}
            >
              {labels.more}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
