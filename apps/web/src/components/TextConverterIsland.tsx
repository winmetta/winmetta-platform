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
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EditIcon,
  RetryIcon,
  SwapIcon,
} from './icons';
import type { ComponentProps, ReactNode } from 'react';
import '../styles/mini-app.css';
import '../styles/burmese-fonts.css';

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
  tabsLabel: string;
  tabConverter: string;
  tabEditor: string;
  editorIntro: string;
  editorEncoding: string;
  editorText: string;
  editorPlaceholder: string;
  editorCopy: string;
  editorCopyLabel: string;
  editorNoteUnicode: string;
  editorNoteZawgyi: string;
  editorNoteWinInnwa: string;
  editorPlain: string;
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

/** The mini apps' outlined 44px button with an icon before its words (docs/design-guide.md §9). */
function MiniButton({
  icon,
  children,
  ...props
}: Omit<ComponentProps<'button'>, 'className' | 'type'> & { icon: ReactNode }) {
  return (
    <button type="button" className="mini-button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

type Tone = 'error' | 'notice' | 'help';

function ConverterPane({ labels }: { labels: Labels }) {
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

  const lines: { text: string; tone: Tone }[] = [];
  const say = (text: string, tone: Tone) => lines.push({ text, tone });
  if (view?.issue === 'too-long') say(labels.tooLong, 'error');
  if (view?.issue === 'choose-source') say(labels.choose, 'error');
  if (view?.detected && !view.noBurmese)
    say(
      view.source === 'zawgyi' ? labels.foundZawgyi : labels.foundUnicode,
      'notice',
    );
  if (view?.noBurmese) say(labels.noBurmese, 'notice');
  if (view?.same) say(labels.same, 'notice');
  if (view && !view.same && (to === 'zawgyi' || to === 'win-innwa'))
    say(labels.lossy, 'help');
  for (const note of view?.notes ?? []) say(noteText(note, labels), 'help');
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
    <div>
      <label className="mini-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="mini-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {auto && <option value="auto">{labels.auto}</option>}
        <option value="unicode">{labels.unicode}</option>
        <option value="zawgyi">{labels.zawgyi}</option>
        <option value="win-innwa">{labels.winInnwa}</option>
      </select>
    </div>
  );

  if (status === 'error')
    return (
      <div className="mini-panel grid gap-3" role="alert">
        <p className="mini-error">{labels.loadError}</p>
        <MiniButton
          icon={<RetryIcon />}
          onClick={() => setAttempt(attempt + 1)}
        >
          {labels.retry}
        </MiniButton>
      </div>
    );

  return (
    <div className="grid gap-4" data-ready={status === 'ready'}>
      <div className="mini-panel grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {picker(
          'converter-from',
          labels.from,
          from,
          (v) => setFrom(v as FromChoice),
          true,
        )}
        <MiniButton
          icon={<SwapIcon />}
          aria-label={labels.swapLabel}
          onClick={doSwap}
          disabled={status !== 'ready'}
        >
          {labels.swap}
        </MiniButton>
        {picker(
          'converter-to',
          labels.to,
          to,
          (v) => setTo(v as Encoding),
          false,
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <label className="mini-label" htmlFor="converter-input">
            {labels.input}
          </label>
          <textarea
            id="converter-input"
            className="mini-field break-all"
            value={input}
            placeholder={labels.inputPlaceholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <MiniButton
              icon={<CloseIcon />}
              onClick={() => {
                setInput('');
                setText('');
              }}
              disabled={input.length === 0}
            >
              {labels.clear}
            </MiniButton>
            <span className="mini-help" aria-hidden="true">
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="grid content-start gap-2">
          <label className="mini-label" htmlFor="converter-output">
            {labels.output}
          </label>
          <textarea
            id="converter-output"
            className="mini-field break-all"
            value={view?.output ?? ''}
            readOnly
            translate="no"
            spellCheck={false}
          />
          <div className="flex items-center">
            <MiniButton
              icon={copied ? <CheckIcon /> : <CopyIcon />}
              aria-label={copied ? labels.copied : labels.copyLabel}
              onClick={copy}
              disabled={!view?.output}
            >
              {copied ? labels.copied : labels.copy}
            </MiniButton>
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite" className="grid gap-2">
        {status === 'loading' && <p className="mini-help">{labels.loading}</p>}
        {outputFont && <p className="mini-help">{outputFont}</p>}
        {lines.map((line) => (
          <p
            key={line.text}
            className={
              line.tone === 'error'
                ? 'mini-error'
                : line.tone === 'notice'
                  ? 'mini-notice'
                  : 'mini-help'
            }
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}

type EditorEncoding = 'unicode' | 'zawgyi' | 'win-innwa';
const EDITOR_FONT: Record<EditorEncoding, string> = {
  unicode: '',
  zawgyi: 'font-zawgyi',
  'win-innwa': 'font-win-innwa',
};

/** A plain-text editor that shows text in the font of its encoding. It never converts anything. */
function EditorPane({ labels }: { labels: Labels }) {
  const [encoding, setEncoding] = useState<EditorEncoding>('unicode');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const choices: [EditorEncoding, string][] = [
    ['unicode', labels.unicode],
    ['zawgyi', labels.zawgyi],
    ['win-innwa', labels.winInnwa],
  ];
  const note = {
    unicode: labels.editorNoteUnicode,
    zawgyi: labels.editorNoteZawgyi,
    'win-innwa': labels.editorNoteWinInnwa,
  }[encoding];
  const copy = () => {
    if (!text) return;
    void copyText(text).then((ok) => {
      setCopied(ok);
      if (ok) window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="grid gap-4">
      <p className="mini-help">{labels.editorIntro}</p>
      <div className="mini-panel grid gap-3">
        <div className="mini-label" id="editor-encoding-label">
          {labels.editorEncoding}
        </div>
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-labelledby="editor-encoding-label"
        >
          {choices.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="mini-choice"
              aria-pressed={encoding === value}
              onClick={() => setEncoding(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mini-help" role="status">
          {note}
        </p>
      </div>
      <div className="grid gap-2">
        <label className="mini-label" htmlFor="editor-text">
          {labels.editorText}
        </label>
        <textarea
          id="editor-text"
          className={`mini-field break-all ${EDITOR_FONT[encoding]}`}
          value={text}
          placeholder={labels.editorPlaceholder}
          spellCheck={false}
          autoComplete="off"
          translate="no"
          maxLength={MAX_CHARS}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex items-center justify-between gap-3">
          <MiniButton
            icon={<CloseIcon />}
            onClick={() => setText('')}
            disabled={text.length === 0}
          >
            {labels.clear}
          </MiniButton>
          <span className="mini-help" aria-hidden="true">
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
          <MiniButton
            icon={copied ? <CheckIcon /> : <CopyIcon />}
            aria-label={copied ? labels.copied : labels.editorCopyLabel}
            onClick={copy}
            disabled={text.length === 0}
          >
            {copied ? labels.copied : labels.editorCopy}
          </MiniButton>
        </div>
      </div>
      <p className="mini-help">{labels.editorPlain}</p>
    </div>
  );
}

type Tab = 'converter' | 'editor';

export default function TextConverterIsland({ labels }: { labels: Labels }) {
  const [tab, setTab] = useState<Tab>('converter');
  const tabs: [Tab, string, ReactNode][] = [
    ['converter', labels.tabConverter, <SwapIcon key="c" />],
    ['editor', labels.tabEditor, <EditIcon key="e" />],
  ];
  return (
    <div className="grid gap-4">
      <div className="mini-views" role="group" aria-label={labels.tabsLabel}>
        {tabs.map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            className="mini-button"
            aria-controls={`converter-pane-${value}`}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div id="converter-pane-converter" hidden={tab !== 'converter'}>
        <ConverterPane labels={labels} />
      </div>
      <div id="converter-pane-editor" hidden={tab !== 'editor'}>
        <EditorPane labels={labels} />
      </div>
    </div>
  );
}
