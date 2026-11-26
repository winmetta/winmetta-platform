// The Burmese text converter (docs/myanmar-converter.md §6). The text never leaves the browser:
// the converters load as a separate chunk on page load and everything runs here.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConvertNote, Encoding } from '@winmetta/myanmar-convert';
import { copyText } from '../lib/clipboard';
import {
  MAX_CHARS,
  run,
  swap,
  type Converter,
  type FromChoice,
} from '../lib/text-converter';
import { CheckIcon, CloseIcon, CopyIcon, RetryIcon, SwapIcon } from './icons';
import { TextAction } from './ui/text-action';

export interface Labels {
  from: string;
  to: string;
  auto: string;
  unicode: string;
  zawgyi: string;
  winInnwa: string;
  swap: string;
  swapLabel: string;
  input: string;
  inputPlaceholder: string;
  output: string;
  copy: string;
  copyLabel: string;
  copied: string;
  clear: string;
  loading: string;
  loadError: string;
  retry: string;
  foundUnicode: string;
  foundZawgyi: string;
  noBurmese: string;
  choose: string;
  tooLong: string;
  same: string;
  fontZawgyi: string;
  fontWinInnwa: string;
  lossy: string;
  /** Has a {chars} placeholder. */
  noteUnmapped: string;
  noteLatin: string;
  noteLooksUnicode: string;
  noteLooksZawgyi: string;
}
type Status = 'loading' | 'ready' | 'error';
// Long text waits a moment after the last key, so typing stays smooth.
const LONG = 5000;
const DELAY = 250;

function noteText(note: ConvertNote, labels: Labels): string {
  switch (note.code) {
    case 'unmapped':
      return labels.noteUnmapped.replace('{chars}', note.chars.join(' '));
    case 'latin-in-win-innwa':
      return labels.noteLatin;
    case 'source-looks-unicode':
      return labels.noteLooksUnicode;
    case 'source-looks-zawgyi':
      return labels.noteLooksZawgyi;
  }
}

export default function TextConverterIsland({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>('loading');
  const converter = useRef<Converter | null>(null);
  const [input, setInput] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState<FromChoice>('auto');
  const [to, setTo] = useState<Encoding>('unicode');
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    import('@winmetta/myanmar-convert').then(
      ({ convert, detect }) => {
        if (!live) return;
        converter.current = { convert, detect };
        setStatus('ready');
      },
      () => live && setStatus('error'),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    const id = window.setTimeout(
      () => setText(input),
      input.length > LONG ? DELAY : 0,
    );
    return () => window.clearTimeout(id);
  }, [input]);

  const view = useMemo(
    () =>
      status === 'ready' && converter.current
        ? run(text, from, to, converter.current)
        : null,
    [status, text, from, to],
  );

  const lines: string[] = [];
  if (view?.issue === 'too-long') lines.push(labels.tooLong);
  if (view?.issue === 'choose-source') lines.push(labels.choose);
  if (view?.detected && !view.noBurmese)
    lines.push(
      view.source === 'zawgyi' ? labels.foundZawgyi : labels.foundUnicode,
    );
  if (view?.noBurmese) lines.push(labels.noBurmese);
  if (view?.same) lines.push(labels.same);
  if (view && !view.same && (to === 'zawgyi' || to === 'win-innwa'))
    lines.push(labels.lossy);
  for (const note of view?.notes ?? []) lines.push(noteText(note, labels));
  const outputFont =
    view?.output && to === 'zawgyi'
      ? labels.fontZawgyi
      : view?.output && to === 'win-innwa'
        ? labels.fontWinInnwa
        : null;

  const doSwap = () => {
    const next = swap(from, to, view?.source ?? null);
    setFrom(next.from);
    setTo(next.to);
    if (view?.output) {
      setInput(view.output);
      setText(view.output);
    }
  };
  const copy = () => {
    if (!view?.output) return;
    void copyText(view.output).then((ok) => {
      setCopied(ok);
      if (ok) window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const picker = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    auto: boolean,
  ) => (
    <label className="block space-y-1" htmlFor={id}>
      <span className="block font-medium">{label}</span>
      <select
        id={id}
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {auto && <option value="auto">{labels.auto}</option>}
        <option value="unicode">{labels.unicode}</option>
        <option value="zawgyi">{labels.zawgyi}</option>
        <option value="win-innwa">{labels.winInnwa}</option>
      </select>
    </label>
  );

  if (status === 'error')
    return (
      <div className="space-y-3" role="alert">
        <p className="muted">{labels.loadError}</p>
        <TextAction
          icon={<RetryIcon />}
          onClick={() => setAttempt(attempt + 1)}
        >
          {labels.retry}
        </TextAction>
      </div>
    );

  return (
    <div className="space-y-4" data-ready={status === 'ready'}>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {picker(
          'converter-from',
          labels.from,
          from,
          (v) => setFrom(v as FromChoice),
          true,
        )}
        <TextAction
          icon={<SwapIcon />}
          aria-label={labels.swapLabel}
          onClick={doSwap}
          disabled={status !== 'ready'}
        >
          {labels.swap}
        </TextAction>
        {picker(
          'converter-to',
          labels.to,
          to,
          (v) => setTo(v as Encoding),
          false,
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block font-medium" htmlFor="converter-input">
            {labels.input}
          </label>
          <textarea
            id="converter-input"
            className="field min-h-56 break-all py-3"
            value={input}
            placeholder={labels.inputPlaceholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <TextAction
              icon={<CloseIcon />}
              onClick={() => {
                setInput('');
                setText('');
              }}
              disabled={input.length === 0}
            >
              {labels.clear}
            </TextAction>
            <span className="badge" aria-hidden="true">
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block font-medium" htmlFor="converter-output">
            {labels.output}
          </label>
          <textarea
            id="converter-output"
            className="field min-h-56 break-all py-3"
            value={view?.output ?? ''}
            readOnly
            translate="no"
            spellCheck={false}
          />
          <div className="flex items-center">
            <TextAction
              icon={copied ? <CheckIcon /> : <CopyIcon />}
              aria-label={copied ? labels.copied : labels.copyLabel}
              onClick={copy}
              disabled={!view?.output}
            >
              {copied ? labels.copied : labels.copy}
            </TextAction>
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite" className="space-y-2">
        {status === 'loading' && <p className="muted">{labels.loading}</p>}
        {outputFont && <p className="muted">{outputFont}</p>}
        {lines.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
