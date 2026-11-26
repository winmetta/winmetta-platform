// The meditation bell's Timer (docs/meditation-bell.md §3): a countdown or an alarm, the start and
// end bell settings and a manual bell. Buttons and labels are English in both locales on purpose
// (§7.1): do not "fix" that. Only alerts, notices and errors are translated.
import { DateTime } from 'luxon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { nextAlarm } from '../../lib/meditation-bell/alarm';
import { track } from '../../lib/analytics';
import * as events from '../../lib/meditation-bell/events';
import {
  format12Hour,
  formatCountdown,
} from '../../lib/meditation-bell/format';
import { defaultState, type BellState } from '../../lib/meditation-bell/schema';
import { sounds } from '../../lib/meditation-bell/sounds';
import * as timers from '../../lib/meditation-bell/timer';
import {
  BellIcon,
  ChevronIcon,
  ClearIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  VolumeIcon,
} from './icons';
import { loadState, saveState } from './storage';
import { keepScreenOn, ring, unlockAudio } from './web-player';

export type Labels = Record<string, string>;
interface Props {
  labels: Labels;
  /** Display name of each sound id. */
  soundNames: Record<string, string>;
}

const presets = [3, 5, 10, 15, 30, 60, 90, 120] as const;
const defaultMinutes = 20;
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_m, key: string) => String(values[key] ?? ''));

interface Notice {
  id: number;
  text: string;
}

/** The local clock time `HH:MM` of a moment, for the "Ring at" field. */
const clockOf = (ms: number) => DateTime.fromMillis(ms).toFormat('HH:mm');

interface PanelProps {
  labels: Labels;
  soundNames: Record<string, string>;
  bell: BellState;
  change: (
    next: BellState,
    role: 'start' | 'end',
    sound: string,
    rings?: number,
  ) => void;
}

function SettingsPanel({ labels, soundNames, bell, change }: PanelProps) {
  return (
    <div id="bell-panel" className="bell-panel space-y-4">
      <div className="bell-row">
        <label htmlFor="bell-start-sound" className="font-semibold">
          {labels.bellStartBell}
        </label>
        <select
          id="bell-start-sound"
          className="field"
          value={bell.startBell.sound}
          onChange={(e) =>
            change(
              { ...bell, startBell: { sound: e.target.value } },
              'start',
              e.target.value,
            )
          }
        >
          <option value="off">{labels.bellOff}</option>
          {sounds.map((s) => (
            <option key={s.id} value={s.id}>
              {soundNames[s.id]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="text-action"
          disabled={bell.startBell.sound === 'off'}
          aria-label={`${labels.bellPlay}: ${labels.bellStartBell}`}
          onClick={() => {
            void unlockAudio();
            void ring(bell.startBell.sound, 1);
          }}
        >
          <VolumeIcon />
          <span>{labels.bellPlay}</span>
        </button>
      </div>
      <div className="bell-row">
        <label htmlFor="bell-end-sound" className="font-semibold">
          {labels.bellEndBell}
        </label>
        <select
          id="bell-end-sound"
          className="field"
          value={bell.endBell.sound}
          onChange={(e) =>
            change(
              {
                ...bell,
                endBell: { ...bell.endBell, sound: e.target.value },
              },
              'end',
              e.target.value,
              bell.endBell.rings,
            )
          }
        >
          {sounds.map((s) => (
            <option key={s.id} value={s.id}>
              {soundNames[s.id]}
            </option>
          ))}
        </select>
        <div className="segmented" role="group" aria-label={labels.bellRings}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={bell.endBell.rings === n}
              onClick={() =>
                change(
                  { ...bell, endBell: { ...bell.endBell, rings: n } },
                  'end',
                  bell.endBell.sound,
                  n,
                )
              }
            >
              {n}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DisplayProps {
  labels: Labels;
  timer: timers.Timer;
  now: number;
  left: number;
  status: string | undefined;
  alarmText: string;
}

/** The progress ring (countdown) or the large clock (alarm), with the status line. */
function Display({
  labels,
  timer,
  now,
  left,
  status,
  alarmText,
}: DisplayProps) {
  const mode = timer.mode;
  const running = timer.status === 'running';
  const alarmEnd = timer.endAt ?? undefined;
  const progress = timer.lengthMs > 0 ? Math.min(1, left / timer.lengthMs) : 0;
  const circumference = 2 * Math.PI * 52;
  return (
    <div className="bell-display" data-status={timer.status}>
      {mode === 'countdown' ? (
        <div
          className="bell-ring"
          role="timer"
          aria-label={labels.bellRingAria}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle cx="60" cy="60" r="52" className="bell-ring__track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="bell-ring__bar"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <span className="bell-ring__time" data-testid="bell-time">
            {formatCountdown(left)}
          </span>
        </div>
      ) : (
        <div
          className="bell-clock"
          role="timer"
          aria-label={labels.bellRingAria}
        >
          <span className="bell-clock__time" data-testid="bell-time">
            {alarmEnd
              ? format12Hour(clockOf(alarmEnd))
              : alarmText
                ? format12Hour(alarmText)
                : '--:--'}
          </span>
          {alarmEnd !== undefined && running && (
            <span className="bell-clock__line">
              {fill(
                DateTime.fromMillis(alarmEnd).hasSame(
                  DateTime.fromMillis(now),
                  'day',
                )
                  ? (labels.bellRingsToday ?? '')
                  : (labels.bellRingsTomorrow ?? ''),
                { left: formatCountdown(left) },
              )}
            </span>
          )}
        </div>
      )}
      <p className="bell-status" data-testid="bell-status">
        {status}
      </p>
    </div>
  );
}

interface PresetsProps {
  labels: Labels;
  alarm: boolean;
  selected: number;
  choose: (minutes: number) => void;
}

function Presets({ labels, alarm, selected, choose }: PresetsProps) {
  return (
    <div className="space-y-3">
      <p className="font-semibold">{labels.bellPresets}</p>
      <div className="bell-presets">
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className="toggle"
            aria-pressed={selected === minutes}
            onClick={() => choose(minutes)}
          >
            {fill(
              alarm
                ? (labels.bellPresetPlus ?? '')
                : (labels.bellPresetMinutes ?? ''),
              { n: minutes },
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface FieldProps {
  labels: Labels;
  mode: timers.TimerMode;
  active: boolean;
  minutesText: string;
  alarmText: string;
  error: { field: 'minutes' | 'alarm'; text: string } | undefined;
  onMinutes: (text: string) => void;
  onAlarm: (text: string) => void;
}

/** Custom minutes (countdown) or the "Ring at" time (alarm), with its error beside it. */
function TimeField({
  labels,
  mode,
  active,
  minutesText,
  alarmText,
  error,
  onMinutes,
  onAlarm,
}: FieldProps) {
  return mode === 'countdown' ? (
    <div className="space-y-2">
      <label htmlFor="bell-minutes" className="font-semibold">
        {labels.bellCustomMinutes}
      </label>
      <input
        id="bell-minutes"
        className="field"
        inputMode="numeric"
        autoComplete="off"
        value={minutesText}
        disabled={active}
        aria-invalid={error?.field === 'minutes'}
        aria-describedby={error?.field === 'minutes' ? 'bell-error' : undefined}
        onChange={(e) => onMinutes(e.target.value)}
      />
      {error?.field === 'minutes' && (
        <p id="bell-error" className="bell-error" role="alert">
          {error.text}
        </p>
      )}
    </div>
  ) : (
    <div className="space-y-2">
      <label htmlFor="bell-alarm" className="font-semibold">
        {labels.bellRingAt}
      </label>
      <input
        id="bell-alarm"
        className="field"
        type="time"
        value={alarmText}
        disabled={active}
        aria-invalid={error?.field === 'alarm'}
        aria-describedby={error?.field === 'alarm' ? 'bell-error' : undefined}
        onChange={(e) => onAlarm(e.target.value)}
      />
      {error?.field === 'alarm' && (
        <p id="bell-error" className="bell-error" role="alert">
          {error.text}
        </p>
      )}
    </div>
  );
}

export default function BellTimer({ labels, soundNames }: Props) {
  const [bell, setBell] = useState<BellState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [panel, setPanel] = useState(false);
  const [minutesText, setMinutesText] = useState(String(defaultMinutes));
  const [alarmText, setAlarmText] = useState('');
  const [error, setError] = useState<{
    field: 'minutes' | 'alarm';
    text: string;
  }>();
  const [source, setSource] = useState<events.StartSource>('preset');
  const nextId = useRef(1);
  const bellRef = useRef(bell);
  bellRef.current = bell;

  const notify = useCallback((text: string) => {
    const id = nextId.current++;
    setNotices((list) => [...list, { id, text }]);
    window.setTimeout(
      () => setNotices((list) => list.filter((n) => n.id !== id)),
      4000,
    );
  }, []);

  const timer =
    bell.timer ??
    timers.createTimer('countdown', timers.minutesToMs(defaultMinutes));
  const mode = timer.mode;
  const running = timer.status === 'running';
  const active = running || timer.status === 'paused';

  /** Change the timer, and mirror it into the saved state. */
  const setTimer = useCallback(
    (next: timers.Timer | null) => setBell((b) => ({ ...b, timer: next })),
    [],
  );

  const send = (event?: {
    name: string;
    data: Record<string, string | number | boolean>;
  }) => {
    if (event) track(event.name, event.data);
  };

  // Load the saved state once the page is in the browser (not during the static build).
  useEffect(() => {
    const result = loadState();
    setBell(result.state);
    if (result.problem === 'broken') notify(labels.bellNoticeBroken ?? '');
    if (result.problem === 'blocked') notify(labels.bellNoticeBlocked ?? '');
    const saved = result.state.timer;
    if (saved) {
      if (saved.mode === 'countdown')
        setMinutesText(
          String(Math.max(1, Math.round(saved.lengthMs / 60_000))),
        );
      if (saved.endAt) setAlarmText(clockOf(saved.endAt));
    }
    setLoaded(true);
  }, [labels, notify]);

  useEffect(() => {
    if (loaded) saveState(bell);
  }, [bell, loaded]);

  /** Has the end passed? Rings, or reports a bell missed while the page was asleep or closed. */
  const check = useCallback(() => {
    const at = Date.now();
    setNow(at);
    const current = bellRef.current.timer;
    if (!current) return;
    const result = timers.tick(current, at);
    if (!result.event) return;
    setTimer(result.timer);
    send(events.timerEnd(current.mode, result.event));
    if (result.event === 'rang') {
      void ring(bellRef.current.endBell.sound, bellRef.current.endBell.rings);
    } else if (current.endAt !== null) {
      notify(
        fill(labels.bellNoticeMissed ?? '', {
          time: format12Hour(clockOf(current.endAt)),
        }),
      );
    }
  }, [labels, notify, setTimer]);

  useEffect(() => {
    if (!loaded) return;
    check();
    const interval = window.setInterval(() => {
      if (bellRef.current.timer?.status === 'running') check();
    }, 1000);
    const wake = () => {
      check();
      void keepScreenOn(bellRef.current.timer?.status === 'running');
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', check);
    };
  }, [loaded, check]);

  // The screen stays on while a timer runs; leaving asks first (MiniAppShell reads this flag).
  useEffect(() => {
    void keepScreenOn(running);
    document.body.dataset.miniAppBusy = String(active);
    return () => {
      delete document.body.dataset.miniAppBusy;
    };
  }, [running, active]);

  const endedBy = (how: events.EndHow) => {
    if (active) send(events.timerEnd(mode, how));
  };

  const chooseMode = (next: timers.TimerMode) => {
    if (next === mode || active) return;
    setError(undefined);
    if (next === 'alarm') {
      setTimer(timers.createTimer('alarm', timers.minutesToMs(defaultMinutes)));
      if (!alarmText)
        setAlarmText(clockOf(Date.now() + defaultMinutes * 60_000));
    } else {
      setTimer(
        timers.createTimer(
          'countdown',
          timers.minutesToMs(Number(minutesText) || defaultMinutes),
        ),
      );
    }
  };

  const choosePreset = (minutes: number) => {
    void unlockAudio();
    endedBy('reset');
    setError(undefined);
    setSource('preset');
    if (mode === 'alarm') {
      setAlarmText(clockOf(Date.now() + minutes * 60_000));
      setTimer(timers.createTimer('alarm', timers.minutesToMs(minutes)));
    } else {
      setMinutesText(String(minutes));
      setTimer(timers.createTimer('countdown', timers.minutesToMs(minutes)));
    }
  };

  const begin = () => {
    void unlockAudio();
    const at = Date.now();
    let lengthMs: number;
    if (mode === 'countdown') {
      const minutes = timers.parseMinutes(minutesText);
      if (minutes === undefined) {
        return setError({
          field: 'minutes',
          text: labels.bellErrMinutes ?? '',
        });
      }
      lengthMs = timers.minutesToMs(minutes);
    } else {
      if (!alarmText)
        return setError({
          field: 'alarm',
          text: labels.bellErrAlarmNone ?? '',
        });
      const result = nextAlarm(alarmText, DateTime.fromMillis(at));
      if (!result.ok) {
        const key =
          result.reason === 'too-far' ? 'bellErrAlarmFar' : 'bellErrAlarmNone';
        return setError({ field: 'alarm', text: labels[key] ?? '' });
      }
      lengthMs = result.msUntil;
    }
    setError(undefined);
    const startSound = bell.startBell.sound;
    if (startSound !== 'off') void ring(startSound, 1);
    setTimer(timers.start(timers.createTimer(mode, lengthMs), at));
    send(
      events.timerStart(
        mode,
        lengthMs,
        mode === 'alarm' && source !== 'preset' ? 'time' : source,
        startSound !== 'off',
      ),
    );
  };

  const resetOrClear = (how: 'reset' | 'cleared') => {
    endedBy(how);
    setError(undefined);
    if (mode === 'alarm' && how === 'cleared') {
      setTimer(timers.createTimer('alarm', timers.minutesToMs(defaultMinutes)));
      setAlarmText('');
    } else {
      setTimer(timers.reset(timer));
    }
  };

  const ringNow = () => {
    void unlockAudio();
    void ring(bell.endBell.sound, 1);
    send(events.ringNow('timer'));
  };

  const change = (
    next: BellState,
    role: 'start' | 'end',
    sound: string,
    rings?: number,
  ) => {
    setBell(next);
    void ring(sound === 'off' ? 'winmetta-short' : sound, 1).then(
      () => undefined,
    );
    if (sound === 'off') return;
    send(events.soundChange(role, sound, rings));
    notify(labels.bellNoticeSaved ?? '');
  };

  const left = timers.msLeft(timer, now);
  const status =
    timer.status === 'running'
      ? labels.bellStatusSitting
      : timer.status === 'paused'
        ? labels.bellStatusPaused
        : timer.status === 'finished'
          ? labels.bellStatusRang
          : timer.status === 'missed'
            ? labels.bellStatusMissed
            : labels.bellStatusReady;
  const selectedMinutes =
    !active && timer.status === 'idle'
      ? Math.round(timer.lengthMs / 60_000)
      : -1;

  return (
    <div className="bell-app space-y-6" data-bell-timer data-ready={loaded}>
      <div className="bell-alerts" role="status" aria-live="polite">
        {notices.map((n) => (
          <p key={n.id} className="bell-notice">
            <span>{n.text}</span>
            <button
              type="button"
              className="text-action"
              aria-label={labels.bellDismiss}
              onClick={() => setNotices((l) => l.filter((x) => x.id !== n.id))}
            >
              <ClearIcon />
            </button>
          </p>
        ))}
      </div>

      <div className="bell-top">
        <button
          type="button"
          className="text-action"
          aria-expanded={panel}
          aria-controls="bell-panel"
          onClick={() => setPanel((p) => !p)}
        >
          <BellIcon />
          <span>{labels.bellBells}</span>
          <ChevronIcon />
        </button>
        <div
          className="segmented"
          role="group"
          aria-label={labels.bellModeLabel}
        >
          {(['countdown', 'alarm'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              disabled={active && mode !== m}
              onClick={() => chooseMode(m)}
            >
              {m === 'countdown'
                ? labels.bellModeCountdown
                : labels.bellModeAlarm}
            </button>
          ))}
        </div>
      </div>

      {panel && (
        <SettingsPanel
          labels={labels}
          soundNames={soundNames}
          bell={bell}
          change={change}
        />
      )}

      <Display
        labels={labels}
        timer={timer}
        now={now}
        left={left}
        status={status}
        alarmText={alarmText}
      />

      <Presets
        labels={labels}
        alarm={mode === 'alarm'}
        selected={mode === 'countdown' ? selectedMinutes : -1}
        choose={choosePreset}
      />

      <TimeField
        labels={labels}
        mode={mode}
        active={active}
        minutesText={minutesText}
        alarmText={alarmText}
        error={error}
        onMinutes={(text) => {
          setMinutesText(text);
          setSource('custom');
          setError(undefined);
        }}
        onAlarm={(text) => {
          setAlarmText(text);
          setSource('time');
          setError(undefined);
        }}
      />

      <div className="bell-actions">
        {running ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setTimer(timers.pause(timer, Date.now()))}
          >
            <PauseIcon />
            {labels.bellPause}
          </button>
        ) : timer.status === 'paused' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void unlockAudio();
              setTimer(timers.resume(timer, Date.now()));
            }}
          >
            <PlayIcon />
            {labels.bellResume}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={begin}>
            <PlayIcon />
            {labels.bellStart}
          </button>
        )}
        {mode === 'countdown' ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => resetOrClear('reset')}
          >
            <ResetIcon />
            {labels.bellReset}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => resetOrClear('cleared')}
          >
            <ClearIcon />
            {labels.bellClear}
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={ringNow}>
          <BellIcon />
          {labels.bellRingNow}
        </button>
      </div>

      <p className="muted text-sm">{labels.bellHelp}</p>
    </div>
  );
}
