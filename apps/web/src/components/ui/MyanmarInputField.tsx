// The shared Burmese field (docs/myanmar-input.md §4): a text box that accepts Myanmar Unicode,
// Zawgyi or Win Innwa keys, shows what it did, and hands the app Unicode. The typing method is the
// site-wide setting (lib/input-method.ts), so a Win Innwa typist chooses once. Nothing typed is
// sent anywhere; only fixed event labels reach the tracker (lib/myanmar-input-events.ts).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { convert } from '@winmetta/myanmar-convert';
import {
  fontFor,
  keyGroups,
  resolveInput,
  switchMethod,
  type FontKind,
  type InputMethod,
  type KeyKind,
  type Note,
  type ResolvedInput,
} from '@winmetta/myanmar-input';
import {
  attachInput,
  insertAtCaret,
  type InputHandle,
  type TextField,
} from '@winmetta/myanmar-input/dom';
import { track } from '../../lib/analytics';
import {
  defaultInput,
  readInputSetting,
  subscribeInputSetting,
  writeInputSetting,
} from '../../lib/input-method';
import * as events from '../../lib/myanmar-input-events';
import {
  noticeLines,
  noteText,
  type InputLabels,
} from '../../lib/myanmar-input-view';
import '../../styles/mini-app.css';
import '../../styles/burmese-fonts.css';

export interface InputChange extends ResolvedInput {
  /** What the box holds: the typed text, or glyph codes in Win Innwa. */
  raw: string;
}

export interface MyanmarInputFieldProps {
  id: string;
  /** The visible label. */
  label: string;
  labels: InputLabels;
  /** The mini app's registry id, for the Pāḷi keys event. */
  app: string;
  /** Apps read `unicode`; it is the only value to store or send. */
  onChange: (change: InputChange) => void;
  /** Which methods the picker offers. Default all three. */
  methods?: readonly InputMethod[];
  /** Show the "Pāḷi keys" tray. */
  showKeys?: boolean;
  multiline?: boolean;
  maxLength?: number;
  /** Written in Unicode; shown in the box's font. */
  placeholder?: string;
  defaultValue?: string;
  /** How long after the last key the font and the notices follow the text. Default 400. */
  settleMs?: number;
}

const FONT_NAME: Record<FontKind, string> = {
  unicode: 'Noto Sans Myanmar',
  zawgyi: 'Zawgyi-One',
  'win-innwa': 'Win Innwa',
};
const FONT_CLASS: Record<FontKind, string> = {
  unicode: '',
  zawgyi: 'font-zawgyi',
  'win-innwa': 'font-win-innwa',
};
const USING_MAX = 80;
const ALL_METHODS: readonly InputMethod[] = ['auto', 'unicode', 'win-innwa'];

const send = (event: events.InputEvent) => track(event.name, event.data);

/** Text written in Unicode, in the encoding the box's font draws. */
function inFont(text: string | undefined, font: FontKind): string | undefined {
  return text && font !== 'unicode'
    ? convert(text, 'unicode', font).text
    : text;
}

/**
 * The line telling the reader which Unicode the app will receive: always in Win Innwa, and in Auto
 * when it differs from what is in the box. Cut short so a long text does not fill the screen.
 */
function usingLine(
  method: InputMethod,
  raw: string,
  unicode: string,
  template: string,
): { before: string; text: string; after: string } | null {
  const shown =
    method === 'win-innwa' || (method === 'auto' && unicode !== raw);
  if (!shown || unicode === '') return null;
  const text =
    unicode.length > USING_MAX ? `${unicode.slice(0, USING_MAX)}…` : unicode;
  const [before = '', after = ''] = template.split('{text}');
  return { before, text, after };
}

/** A value that follows `value` after `delay` ms, so the font does not flip mid-word. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return settled;
}

export default function MyanmarInputField({
  id,
  label,
  labels,
  app,
  onChange,
  methods = ALL_METHODS,
  showKeys = false,
  multiline = false,
  maxLength,
  placeholder,
  defaultValue = '',
  settleMs = 400,
}: MyanmarInputFieldProps) {
  const setting = useSyncExternalStore(
    subscribeInputSetting,
    readInputSetting,
    () => defaultInput,
  );
  const [raw, setRaw] = useState(defaultValue);
  const [extraNotes, setExtraNotes] = useState<Note[]>([]);
  const fieldRef = useRef<TextField | null>(null);
  const handle = useRef<InputHandle | null>(null);
  const latestRaw = useRef(raw);
  latestRaw.current = raw;
  const previousMethod = useRef(setting.method);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const result = useMemo(
    () => resolveInput(raw, { method: setting.method, multiline }),
    [raw, setting.method, multiline],
  );

  // The method can change here, on the Settings page or in another tab. The box is converted to
  // the new method's form, never cleared and never left to be misread (docs §2.2).
  useEffect(() => {
    const from = previousMethod.current;
    if (from === setting.method) return;
    previousMethod.current = setting.method;
    const next = switchMethod(latestRaw.current, from, setting.method);
    setRaw(next.raw);
    setExtraNotes(next.notes);
  }, [setting.method]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const attached = attachInput(field, {
      method: setting.method,
      stackKey: setting.stackKey,
      onPasteConverted: setExtraNotes,
    });
    handle.current = attached;
    return () => attached.detach();
    // Attached once; later changes go through `update` below.
  }, []);
  useEffect(() => {
    handle.current?.update({
      method: setting.method,
      stackKey: setting.stackKey,
    });
  }, [setting.method, setting.stackKey]);

  useEffect(() => {
    onChangeRef.current({ raw, ...result });
  }, [raw, result]);

  const settled = useSettled(result, settleMs);
  const font = fontFor(setting.method, settled);
  const lines = [
    ...noticeLines(settled, labels),
    ...extraNotes.flatMap((note) => noteText(note, labels) ?? []),
  ];

  const shownPlaceholder = inFont(placeholder, font);

  const choose = (method: InputMethod) => {
    if (method === setting.method) return;
    send(events.methodChange(method, 'field'));
    writeInputSetting({ method });
  };

  const insertKey = useCallback(
    (text: string, kind: KeyKind) => {
      const field = fieldRef.current;
      if (!field) return;
      send(events.keysUse(app, kind));
      if (!insertAtCaret(field, text)) setRaw((value) => value + text);
      field.focus();
    },
    [app],
  );

  const captionId = `${id}-caption`;
  const using = usingLine(setting.method, raw, result.unicode, labels.using);

  const fieldProps = {
    id,
    className: `mini-field break-all ${FONT_CLASS[font]}`.trim(),
    value: raw,
    placeholder: shownPlaceholder,
    maxLength,
    spellCheck: false,
    autoComplete: 'off',
    translate: 'no' as const,
    'aria-describedby': captionId,
    onChange: (event: { target: { value: string } }) => {
      setExtraNotes([]);
      setRaw(event.target.value);
    },
  };

  return (
    <div className="grid gap-2" data-input-method={setting.method}>
      <label className="mini-label" htmlFor={id}>
        {label}
      </label>
      {methods.length > 1 && (
        <MethodChoice
          methods={methods}
          value={setting.method}
          labels={labels}
          onChoose={choose}
        />
      )}
      {multiline ? (
        <textarea
          {...fieldProps}
          ref={(element) => {
            fieldRef.current = element;
          }}
        />
      ) : (
        <input
          {...fieldProps}
          type="text"
          ref={(element) => {
            fieldRef.current = element;
          }}
        />
      )}
      <p className="mini-help" id={captionId}>
        {labels.shownIn.replace('{font}', FONT_NAME[font])}
      </p>
      {setting.method === 'win-innwa' && setting.stackKey && (
        <p className="mini-help">{labels.stackHint}</p>
      )}
      <div role="status" aria-live="polite" className="grid gap-2">
        {using && (
          <p className="mini-help" data-using>
            {using.before}
            <span lang="my" translate="no">
              {using.text}
            </span>
            {using.after}
          </p>
        )}
        {lines.map((line) => (
          <p key={line} className="mini-help">
            {line}
          </p>
        ))}
      </div>
      {showKeys && (
        <KeysTray method={setting.method} labels={labels} onKey={insertKey} />
      )}
    </div>
  );
}

/** The method choice: three short joined buttons bound to the site-wide setting. */
function MethodChoice({
  methods,
  value,
  labels,
  onChoose,
}: {
  methods: readonly InputMethod[];
  value: InputMethod;
  labels: InputLabels;
  onChoose: (method: InputMethod) => void;
}) {
  const names: Record<InputMethod, string> = {
    auto: labels.auto,
    unicode: labels.unicode,
    'win-innwa': labels.winInnwa,
  };
  return (
    <div className="flex items-center gap-3">
      <span className="mini-help shrink-0">{labels.method}</span>
      <div className="mini-choices" role="group" aria-label={labels.method}>
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            className="mini-choice"
            aria-pressed={value === method}
            onClick={() => onChoose(method)}
          >
            {names[method]}
          </button>
        ))}
      </div>
    </div>
  );
}

type InsertKey = (text: string, kind: KeyKind) => void;

/** The "Pāḷi keys" disclosure: rows of small keys that type Burmese letters into the box. */
function KeysTray({
  method,
  labels,
  onKey,
}: {
  method: InputMethod;
  labels: InputLabels;
  onKey: InsertKey;
}) {
  return (
    <details className="mini-keys">
      <summary>{labels.keysTitle}</summary>
      <div className="grid gap-3 pt-2">
        {keyGroups(method).map((group) => (
          <div key={group.id} className="grid gap-1">
            <p className="mini-help">{groupTitle(group.id, labels)}</p>
            <div className="mini-keys-row">
              {group.keys.map((key) => (
                <button
                  key={key.unicode}
                  type="button"
                  className="mini-key"
                  lang="my"
                  translate="no"
                  // Keep the caret in the box: a tap must not take the focus away from it.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onKey(key.insert, key.kind)}
                >
                  {keyLabel(key.kind, key.unicode)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function groupTitle(
  group: ReturnType<typeof keyGroups>[number]['id'],
  labels: InputLabels,
): string {
  switch (group) {
    case 'stacked':
      return labels.keysStacked;
    case 'independent':
      return labels.keysLetters;
    case 'ligatures':
      return labels.keysLigatures;
    case 'kinzi':
      return labels.keysKinzi;
    case 'punctuation':
      return labels.keysPunctuation;
  }
}

/** A stack or kinzi is a mark, so the key shows it on a dotted circle. */
const keyLabel = (kind: string, unicode: string): string =>
  kind === 'stack' || kind === 'kinzi' ? `◌${unicode}` : unicode;
