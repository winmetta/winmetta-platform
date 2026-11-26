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
  RetryIcon,
  SwapIcon,
  SwapVerticalIcon,
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
  copyInputLabel: string;
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
  previewAs: string;
  fontLabel: string;
  /** Has a {font} placeholder. */
  shownIn: string;
  /** Has a {font} placeholder. */
  shownInUnicode: string;
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

/** The mini apps' outlined 44px button with an icon before its words (docs/design-guide.md §9). */
function MiniButton({
  icon,
  small,
  danger,
  children,
  ...props
}: Omit<ComponentProps<'button'>, 'className' | 'type'> & {
  icon: ReactNode;
  small?: boolean;
  /** A destructive action (clear, delete): red, so it does not look like the harmless ones. */
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'mini-button',
        small && 'mini-button--small',
        danger && 'mini-button--danger',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** The font a text area shows its text in: three joined buttons (the text itself never changes). */
function FontChoice({
  id,
  label,
  value,
  onChange,
  labels,
}: {
  id: string;
  label: string;
  value: Encoding;
  onChange: (value: Encoding) => void;
  labels: Labels;
}) {
  const choices: [Encoding, string][] = [
    ['unicode', labels.unicode],
    ['zawgyi', labels.zawgyi],
    ['win-innwa', labels.winInnwa],
  ];
  return (
    <div className="flex items-center gap-3">
      <span className="mini-help shrink-0" id={id}>
        {labels.fontLabel}
      </span>
      <div
        className="mini-choices"
        role="group"
        aria-label={label}
        aria-describedby={id}
      >
        {choices.map(([choice, text]) => (
          <button
            key={choice}
            type="button"
            className="mini-choice"
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

type Tone = 'error' | 'notice' | 'help';

const FONT_NAME: Record<Encoding, string> = {
  unicode: 'Noto Sans Myanmar',
  zawgyi: 'Zawgyi-One',
  'win-innwa': 'Win Innwa',
};

function shownIn(labels: Labels, encoding: Encoding): string {
  const text = encoding === 'unicode' ? labels.shownInUnicode : labels.shownIn;
  return text.replace('{font}', FONT_NAME[encoding]);
}

const FONT_CLASS: Record<Encoding, string> = {
  unicode: '',
  zawgyi: 'font-zawgyi',
  'win-innwa': 'font-win-innwa',
};

export default function TextConverterIsland({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>('loading');
  const converter = useRef<Converter | null>(null);
  const [input, setInput] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState<FromChoice>('auto');
  const [to, setTo] = useState<Encoding>('unicode');
  const [previewFont, setPreviewFont] = useState<Encoding | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedInput, setCopiedInput] = useState(false);
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
  // The input is shown in the font the reader picks; until they pick, the font of its encoding.
  const inputFont =
    previewFont ?? view?.source ?? (from === 'auto' ? 'unicode' : from);

  // The placeholder is written in the encoding of the font, so it reads correctly in that font.
  const placeholder =
    status === 'ready' && converter.current && inputFont !== 'unicode'
      ? converter.current.convert(labels.inputPlaceholder, 'unicode', inputFont)
          .text
      : labels.inputPlaceholder;

  const doSwap = () => {
    const next = swap(from, to, view?.source ?? null);
    setFrom(next.from);
    setTo(next.to);
    setPreviewFont(null);
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

  const copyInput = () => {
    if (!input) return;
    void copyText(input).then((ok) => {
      setCopiedInput(ok);
      if (ok) window.setTimeout(() => setCopiedInput(false), 2000);
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
          (v) => {
            setFrom(v as FromChoice);
            setPreviewFont(null);
          },
          true,
        )}
        <div className="flex items-center justify-center sm:h-11">
          <MiniButton
            small
            icon={
              <>
                <span className="inline-flex sm:hidden" aria-hidden="true">
                  <SwapVerticalIcon />
                </span>
                <span className="hidden sm:inline-flex" aria-hidden="true">
                  <SwapIcon />
                </span>
              </>
            }
            aria-label={labels.swapLabel}
            onClick={doSwap}
            disabled={status !== 'ready'}
          >
            {labels.swap}
          </MiniButton>
        </div>
        {picker(
          'converter-to',
          labels.to,
          to,
          (v) => setTo(v as Encoding),
          false,
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:grid-rows-[auto_auto_1fr_auto_auto] md:gap-x-4 md:gap-y-2">
        <div className="grid content-start gap-2 md:row-span-5 md:grid-rows-subgrid">
          <label className="mini-label" htmlFor="converter-input">
            {labels.input}
          </label>
          <FontChoice
            id="converter-preview-font"
            label={labels.previewAs}
            value={inputFont}
            onChange={setPreviewFont}
            labels={labels}
          />
          <textarea
            id="converter-input"
            className={`mini-field break-all ${FONT_CLASS[inputFont]}`}
            value={input}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            translate="no"
            onChange={(event) => setInput(event.target.value)}
          />
          <p className="mini-help">{shownIn(labels, inputFont)}</p>
          <div className="flex items-center gap-2">
            <MiniButton
              small
              icon={copiedInput ? <CheckIcon /> : <CopyIcon />}
              aria-label={copiedInput ? labels.copied : labels.copyInputLabel}
              onClick={copyInput}
              disabled={input.length === 0}
            >
              {copiedInput ? labels.copied : labels.copy}
            </MiniButton>
            <MiniButton
              small
              danger
              icon={<CloseIcon />}
              onClick={() => {
                setInput('');
                setText('');
              }}
              disabled={input.length === 0}
            >
              {labels.clear}
            </MiniButton>
            <span className="mini-help ms-auto" aria-hidden="true">
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="grid content-start gap-2 md:row-span-5 md:grid-rows-subgrid">
          <label
            className="mini-label md:self-center"
            htmlFor="converter-output"
          >
            {labels.output}
          </label>
          <textarea
            id="converter-output"
            className={`mini-field break-all md:row-start-3 ${FONT_CLASS[to]}`}
            value={view?.output ?? ''}
            readOnly
            translate="no"
            spellCheck={false}
          />
          <p className="mini-help md:row-start-4">{shownIn(labels, to)}</p>
          <div className="flex items-center md:row-start-5">
            <MiniButton
              small
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
