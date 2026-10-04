import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyState,
  filterRetreats,
  isActive,
  readState,
  writeState,
  type RetreatItem,
  type RetreatState,
} from '../lib/retreat-filter';
import { Button } from './ui/button';

export interface ArchiveLabels {
  searchLabel: string;
  searchPlaceholder: string;
  year: string;
  format: string;
  days: string;
  teacher: string;
  all: string;
  reset: string;
  noResults: string;
  /** "{n} retreats" with {n} replaced at render. */
  count: string;
  formats: Record<RetreatItem['format'], string>;
  /** "{n} days" with {n} replaced at render. */
  daysCount: string;
}
interface Props {
  items: RetreatItem[];
  labels: ArchiveLabels;
}

const fill = (template: string, n: number) =>
  template.replace('{n}', String(n));

// Server-rendered with the full list (works without JavaScript); after hydration the URL's
// ?q=&year=&format=&days=&teacher= narrows it, and every change is written back to the URL.
export default function RetreatArchive({ items, labels }: Props) {
  const [state, setState] = useState<RetreatState>(emptyState);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Text typed before hydration finished is kept, not wiped by the empty server-rendered state.
    const apply = (adoptTyped: boolean) => {
      const next = readState(window.location.search);
      const typed = adoptTyped ? (input.current?.value ?? '') : '';
      const q = next.q || typed;
      setState({ ...next, q });
      if (q !== next.q)
        window.history.replaceState(
          null,
          '',
          writeState({ ...next, q }, window.location),
        );
    };
    apply(true);
    const onPopState = () => apply(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const update = (patch: Partial<RetreatState>) => {
    const next = { ...state, ...patch };
    setState(next);
    window.history.replaceState(null, '', writeState(next, window.location));
  };
  const years = useMemo(
    () => [...new Set(items.map((i) => i.year))].sort((a, b) => b - a),
    [items],
  );
  const lengths = useMemo(
    () => [...new Set(items.map((i) => i.days))].sort((a, b) => a - b),
    [items],
  );
  const teachers = useMemo(
    () => [
      ...new Map(
        items.flatMap((i) => i.teachers).map((t) => [t.id, t]),
      ).values(),
    ],
    [items],
  );
  const shown = useMemo(() => filterRetreats(items, state), [items, state]);

  const select = (
    key: 'year' | 'format' | 'days' | 'teacher',
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label className="space-y-1">
      <span className="block font-medium">{label}</span>
      <select
        className="field"
        value={state[key]}
        onChange={(event) => update({ [key]: event.target.value })}
      >
        <option value="">{labels.all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 sm:col-span-2 lg:col-span-4">
          <span className="block font-medium">{labels.searchLabel}</span>
          <input
            ref={input}
            type="search"
            className="field"
            value={state.q}
            placeholder={labels.searchPlaceholder}
            autoComplete="off"
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        {select(
          'year',
          labels.year,
          years.map((y) => ({ value: String(y), label: String(y) })),
        )}
        {select(
          'format',
          labels.format,
          (['online', 'onsite', 'hybrid'] as const).map((f) => ({
            value: f,
            label: labels.formats[f],
          })),
        )}
        {select(
          'days',
          labels.days,
          lengths.map((d) => ({
            value: String(d),
            label: fill(labels.daysCount, d),
          })),
        )}
        {select(
          'teacher',
          labels.teacher,
          teachers.map((t) => ({ value: t.id, label: t.name })),
        )}
      </div>
      <div
        className="flex flex-wrap items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <p>{fill(labels.count, shown.length)}</p>
        {isActive(state) ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => update({ ...emptyState })}
          >
            {labels.reset}
          </Button>
        ) : null}
      </div>
      {shown.length === 0 ? <p>{labels.noResults}</p> : null}
      <ul className="grid gap-4 lg:grid-cols-2">
        {shown.map((item) => (
          <li key={item.id} className="card card-link space-y-2">
            <a className="link text-lg" href={item.href}>
              {item.title}
            </a>
            <p className="text-sm">
              {item.dates}
              <span className="muted"> · {labels.formats[item.format]}</span>
            </p>
            <p className="muted text-sm">
              {item.teachers.map((t) => t.name).join(', ')}
              {item.venue ? ` · ${item.venue}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
