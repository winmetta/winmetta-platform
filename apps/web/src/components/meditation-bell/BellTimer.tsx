// The meditation bell's Timer (docs/meditation-bell.md §3): a countdown or an alarm, the start and
// end bell settings and a manual bell. Buttons and labels are English in both locales on purpose
// (§7.1): do not "fix" that. Only alerts, notices and errors are translated.
import { DateTime } from 'luxon';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { nextAlarm } from '../../lib/meditation-bell/alarm';
import { track } from '../../lib/analytics';
import * as events from '../../lib/meditation-bell/events';
import {
  format12Hour,
  formatCountdown,
} from '../../lib/meditation-bell/format';
import { bellCount, type Week } from '../../lib/meditation-bell/schedule';
import {
  defaultState,
  storageKey,
  type BellState,
} from '../../lib/meditation-bell/schema';
import { sounds } from '../../lib/meditation-bell/sounds';
import * as timers from '../../lib/meditation-bell/timer';
import {
  AlarmIcon,
  BellIcon,
  CalendarIcon,
  CountdownIcon,
  ChevronIcon,
  ClearIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  VolumeIcon,
} from './icons';
import BellSchedule, { type ScheduleConfirmation } from './BellSchedule';
import { fill, type Labels } from './labels';
import { useWeeklyBells } from './use-weekly-bells';
import { checkpointChange, loadState, saveState } from './storage';
import { audioIsUnlocked, keepScreenOn, ring, unlockAudio } from './web-player';

interface Props {
  labels: Labels;
  /** Display name of each sound id. */
  soundNames: Record<string, string>;
}

const presets = [3, 5, 10, 15, 30, 60, 90, 120] as const;
const defaultMinutes = 20;

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
    <div id="bell-panel" className="bell-panel">
      <div className="bell-row">
        <label htmlFor="bell-start-sound" className="font-semibold">
          {labels.bellStartBell}
        </label>
        <select
          id="bell-start-sound"
          className="bell-field"
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
          className="bell-button"
          disabled={bell.startBell.sound === 'off'}
          aria-label={`${labels.bellPlay}: ${labels.bellStartBell}`}
          onClick={() => {
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
          className="bell-field"
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
        <div
          className="bell-ring-count"
          role="group"
          aria-label={labels.bellRings}
        >
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
          <div className="bell-ring__readout">
            <span className="bell-ring__time" data-testid="bell-time">
              {formatCountdown(left)}
            </span>
            <p className="bell-status" data-testid="bell-status">
              {status}
            </p>
          </div>
        </div>
      ) : (
        <div className="bell-clock">
          <AlarmIcon />
          <span className="bell-clock__time" data-testid="bell-time">
            {alarmEnd
              ? format12Hour(clockOf(alarmEnd))
              : alarmText
                ? format12Hour(alarmText)
                : '––:––'}
          </span>
          {alarmEnd !== undefined && running && (
            <span className="bell-clock__line">
              {DateTime.fromMillis(alarmEnd).hasSame(
                DateTime.fromMillis(now),
                'day',
              )
                ? labels.bellRingsToday
                : labels.bellRingsTomorrow}
            </span>
          )}
          <p className="bell-status" data-testid="bell-status">
            {timer.status === 'idle' && !alarmText
              ? labels.bellAlarmPrompt
              : running
                ? labels.bellAlarmSet
                : status}
          </p>
        </div>
      )}
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
    <div className="bell-preset-group">
      <p>{alarm ? labels.bellAlarmPresets : labels.bellPresets}</p>
      <div className="bell-presets">
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className="bell-choice"
            aria-pressed={selected === minutes}
            aria-label={fill(
              alarm
                ? (labels.bellPresetPlus ?? '')
                : (labels.bellPresetMinutes ?? ''),
              { n: minutes },
            )}
            onClick={() => choose(minutes)}
          >
            {alarm ? `+${minutes}` : minutes}
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
    <div className="bell-input-row">
      <label htmlFor="bell-minutes" className="font-semibold">
        {labels.bellCustomMinutes}
      </label>
      <input
        id="bell-minutes"
        className="bell-field"
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
    <div className="bell-input-row">
      <label htmlFor="bell-alarm" className="font-semibold">
        {labels.bellRingAt}
      </label>
      <input
        id="bell-alarm"
        className="bell-field"
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

const timerStatusLabel = {
  running: 'bellStatusSitting',
  paused: 'bellStatusPaused',
  finished: 'bellStatusRang',
  missed: 'bellStatusMissed',
  idle: 'bellStatusReady',
} as const;

function selectedPreset(
  timer: timers.Timer,
  countdownSource: 'preset' | 'custom',
  alarmPreset?: number,
) {
  if (timer.status !== 'idle') return -1;
  if (timer.mode === 'alarm') return alarmPreset ?? -1;
  return countdownSource === 'preset'
    ? Math.round(timer.lengthMs / 60_000)
    : -1;
}

const send = (event?: events.BellEvent) => {
  if (event) track(event.name, event.data);
};

export default function BellTimer(props: Props) {
  const [resetVersion, setResetVersion] = useState(0);
  const reset = useCallback(
    () => setResetVersion((version) => version + 1),
    [],
  );

  return <BellTimerSession key={resetVersion} {...props} reset={reset} />;
}

function BellTimerSession({
  labels,
  soundNames,
  reset,
}: Props & { reset: () => void }) {
  const [bell, setBell] = useState<BellState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [panel, setPanel] = useState(false);
  const [view, setView] = useState<'timer' | 'schedule'>('timer');
  const [keepAwake, setKeepAwake] = useState(false);
  const [audioReady, setAudioReady] = useState(audioIsUnlocked);
  const [confirmation, setConfirmation] = useState<ScheduleConfirmation>();
  const confirmationButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [minutesText, setMinutesText] = useState(String(defaultMinutes));
  const [alarmText, setAlarmText] = useState('');
  const [error, setError] = useState<{
    field: 'minutes' | 'alarm';
    text: string;
  }>();
  const [countdownSource, setCountdownSource] = useState<'preset' | 'custom'>(
    'preset',
  );
  const [alarmPreset, setAlarmPreset] = useState<number>();
  const nextId = useRef(1);
  const bellRef = useRef(bell);
  const lastRead = useRef<string | null | undefined>(undefined);
  const storageWarningShown = useRef(false);

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
  const keepScreen = running || (bell.schedule.on && keepAwake);
  const busy = active || bell.schedule.on;

  const updateBell = useCallback(
    (update: (current: BellState) => BellState) => {
      const next = update(bellRef.current);
      const saved = saveState(next, lastRead.current);
      if (saved.status === 'changed') {
        bellRef.current = defaultState();
        reset();
        return false;
      }
      if (saved.status === 'saved') lastRead.current = saved.raw;
      if (saved.status === 'blocked' && !storageWarningShown.current) {
        storageWarningShown.current = true;
        notify(labels.bellNoticeBlocked ?? '');
      }
      bellRef.current = next;
      setBell(next);
      return true;
    },
    [labels, notify, reset],
  );

  const setTimer = useCallback(
    (next: timers.Timer | null) =>
      updateBell((current) => ({ ...current, timer: next })),
    [updateBell],
  );

  const unlock = useCallback(async () => {
    const ready = await unlockAudio();
    setAudioReady(ready);
    return ready;
  }, []);

  const ask = (next: ScheduleConfirmation) => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(next);
  };

  const dismissConfirmation = (confirmed: boolean) => {
    if (!confirmation) return;
    setConfirmation(undefined);
    if (confirmed) confirmation.confirm();
    else confirmation.cancel?.();
    const origin = previousFocus.current;
    window.requestAnimationFrame(() => {
      if (origin?.getClientRects().length) origin.focus();
    });
  };

  const dismissOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') dismissConfirmation(false);
  };

  useEffect(() => {
    if (confirmation) confirmationButton.current?.focus();
  }, [confirmation]);

  const updateWeek = (week: Week) => {
    updateBell((current) => ({
      ...current,
      schedule: { ...current.schedule, week, checkedAt: Date.now() },
    }));
  };

  useWeeklyBells({
    loaded,
    audioReady,
    on: bell.schedule.on,
    getSchedule: () => bellRef.current.schedule,
    checkpoint: (checkedAt) =>
      updateBell((current) => ({
        ...current,
        schedule: { ...current.schedule, checkedAt },
      })),
    missed: (time, day) =>
      notify(fill(labels.bellScheduleMissed ?? '', { time, day })),
    send,
  });

  // Load the saved state once the page is in the browser (not during the static build).
  useEffect(() => {
    const result = loadState();
    lastRead.current = result.raw;
    bellRef.current = result.state;
    setBell(result.state);
    if (result.problem === 'broken') notify(labels.bellNoticeBroken ?? '');
    if (result.problem === 'blocked') {
      storageWarningShown.current = true;
      notify(labels.bellNoticeBlocked ?? '');
    }

    const saved = result.state.timer;
    if (saved) {
      if (saved.mode === 'countdown')
        setMinutesText(
          String(Math.max(1, Math.round(saved.lengthMs / 60_000))),
        );
      if (saved.mode === 'alarm' && saved.endAt !== null)
        setAlarmText(clockOf(saved.endAt));
    }
    setLoaded(true);

    const sync = (event: StorageEvent) => {
      if (
        (event.key !== storageKey && event.key !== null) ||
        event.storageArea !== window.localStorage ||
        event.newValue === lastRead.current
      )
        return;
      const checkedAt = checkpointChange(
        lastRead.current ?? null,
        event.newValue,
      );
      if (checkedAt !== undefined) {
        lastRead.current = event.newValue;
        const current = bellRef.current;
        bellRef.current = {
          ...current,
          schedule: { ...current.schedule, checkedAt },
        };
      } else {
        bellRef.current = defaultState();
        reset();
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [labels, notify, reset]);

  /** Has the end passed? Rings, or reports a bell missed while the page was asleep or closed. */
  const check = useCallback(() => {
    const at = Date.now();
    setNow(at);
    const current = bellRef.current.timer;
    if (!current) return;
    const result = timers.tick(current, at);
    if (!result.event) return;
    if (!setTimer(result.timer)) return;
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
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', check);
    };
  }, [loaded, check]);

  useEffect(() => {
    const wake = () => void keepScreenOn(keepScreen);
    wake();
    document.addEventListener('visibilitychange', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      void keepScreenOn(false);
    };
  }, [keepScreen]);

  useEffect(() => {
    document.body.dataset.miniAppBusy = String(busy);
    return () => {
      delete document.body.dataset.miniAppBusy;
    };
  }, [busy]);

  const endedBy = (how: events.EndHow) => {
    if (active) send(events.timerEnd(mode, how));
  };

  const chooseMode = (next: timers.TimerMode) => {
    if (next === mode || active) return;
    setError(undefined);
    if (next === 'alarm') {
      setTimer(timers.createTimer('alarm', timers.minutesToMs(defaultMinutes)));
    } else {
      const minutes = timers.parseMinutes(minutesText);
      setTimer(
        timers.createTimer(
          'countdown',
          timers.minutesToMs(minutes ?? defaultMinutes),
        ),
      );
    }
  };

  const choosePreset = (minutes: number) => {
    void unlock();
    endedBy('reset');
    setError(undefined);
    if (mode === 'alarm') {
      setAlarmPreset(minutes);
      setAlarmText(clockOf(Date.now() + minutes * 60_000));
      setTimer(timers.createTimer('alarm', timers.minutesToMs(minutes)));
    } else {
      setCountdownSource('preset');
      setMinutesText(String(minutes));
      setTimer(timers.createTimer('countdown', timers.minutesToMs(minutes)));
    }
  };

  const begin = () => {
    void unlock();
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
    const start = () => {
      const currentTime = Date.now();
      const started = updateBell((current) => ({
        ...current,
        timer: timers.start(
          timers.createTimer(mode, lengthMs),
          mode === 'alarm' ? at : currentTime,
        ),
        schedule: current.schedule.on
          ? { ...current.schedule, on: false }
          : current.schedule,
      }));
      if (!started) return;
      void unlock();
      const startSound = bell.startBell.sound;
      if (startSound !== 'off') void ring(startSound, 1);
      if (bell.schedule.on)
        send(events.scheduleSwitch(false, bellCount(bell.schedule.week)));
      const source =
        mode === 'countdown'
          ? countdownSource
          : alarmPreset === undefined
            ? 'time'
            : 'preset';
      send(events.timerStart(mode, lengthMs, source, startSound !== 'off'));
    };
    if (bell.schedule.on) {
      ask({
        message: labels.bellConflictStart ?? '',
        action: labels.bellConflictStartAction ?? '',
        confirm: () => {
          send(events.conflict('start_timer', 'confirm'));
          start();
        },
        cancel: () => send(events.conflict('start_timer', 'cancel')),
      });
    } else {
      start();
    }
  };

  const switchSchedule = () => {
    const turnOn = !bell.schedule.on;
    const apply = () => {
      if (turnOn) void unlock();
      const current = bellRef.current.timer;
      const stop =
        turnOn &&
        (current?.status === 'running' || current?.status === 'paused');
      if (stop) send(events.timerEnd(current.mode, 'reset'));
      updateBell((state) => ({
        ...state,
        timer: stop ? timers.reset(current) : current,
        schedule: { ...state.schedule, on: turnOn, checkedAt: Date.now() },
      }));
      send(events.scheduleSwitch(turnOn, bellCount(bell.schedule.week)));
      notify(
        (turnOn ? labels.bellScheduleEnabled : labels.bellScheduleDisabled) ??
          '',
      );
    };
    if (turnOn && active) {
      ask({
        message: labels.bellConflictSchedule ?? '',
        action: labels.bellConflictScheduleAction ?? '',
        confirm: () => {
          send(events.conflict('schedule_on', 'confirm'));
          apply();
        },
        cancel: () => send(events.conflict('schedule_on', 'cancel')),
      });
    } else {
      apply();
    }
  };

  const resetOrClear = (how: 'reset' | 'cleared') => {
    endedBy(how);
    setError(undefined);
    if (mode === 'alarm' && how === 'cleared') {
      setTimer(timers.createTimer('alarm', timers.minutesToMs(defaultMinutes)));
      setAlarmText('');
      setAlarmPreset(undefined);
    } else {
      setTimer(timers.reset(timer));
    }
  };

  const ringNow = () => {
    void unlock();
    void ring(bell.endBell.sound, 1);
    send(events.ringNow(view));
  };

  const change = (
    next: BellState,
    role: 'start' | 'end',
    sound: string,
    rings?: number,
  ) => {
    updateBell(() => next);
    void unlock();
    void ring(sound === 'off' ? 'winmetta-short' : sound, 1).then(
      () => undefined,
    );
    if (sound === 'off') return;
    send(events.soundChange(role, sound, rings));
    notify(labels.bellNoticeSaved ?? '');
  };

  const left = timers.msLeft(timer, now);
  const status = labels[timerStatusLabel[timer.status]];
  const selectedMinutes = selectedPreset(timer, countdownSource, alarmPreset);

  return (
    <div className="bell-app" data-bell-timer data-ready={loaded}>
      <div
        className="bell-views"
        role="group"
        aria-label={labels.bellViewLabel}
        inert={Boolean(confirmation)}
      >
        <button
          type="button"
          className="bell-button"
          aria-controls="bell-timer-view"
          aria-pressed={view === 'timer'}
          onClick={() => setView('timer')}
        >
          <CountdownIcon />
          {labels.bellTimerHeading}
        </button>
        <button
          type="button"
          className="bell-button"
          aria-controls="bell-schedule-view"
          aria-pressed={view === 'schedule'}
          onClick={() => setView('schedule')}
        >
          <CalendarIcon />
          {labels.bellScheduleHeading}
        </button>
      </div>

      {confirmation && (
        <div
          className="bell-confirmation"
          role="alertdialog"
          aria-labelledby="bell-confirmation-message"
        >
          <p id="bell-confirmation-message">{confirmation.message}</p>
          <div className="bell-actions">
            <button
              type="button"
              className="bell-button bell-button--start"
              onClick={() => dismissConfirmation(true)}
              onKeyDown={dismissOnEscape}
            >
              {confirmation.action}
            </button>
            <button
              ref={confirmationButton}
              type="button"
              className="bell-button"
              onClick={() => dismissConfirmation(false)}
              onKeyDown={dismissOnEscape}
            >
              {labels.bellScheduleCancel}
            </button>
          </div>
        </div>
      )}
      {bell.schedule.on && !audioReady && loaded && (
        <div
          className="bell-notice bell-audio-notice"
          inert={Boolean(confirmation)}
        >
          <p role="status">{labels.bellScheduleAudioPrompt}</p>
          <button
            type="button"
            className="bell-button"
            onClick={() => void unlock()}
          >
            <VolumeIcon />
            {labels.bellScheduleEnableSound}
          </button>
        </div>
      )}
      <div className="bell-alerts" role="status" aria-live="polite">
        {notices.map((n) => (
          <p key={n.id} className="bell-notice">
            <span>{n.text}</span>
            <button
              type="button"
              className="bell-button"
              aria-label={labels.bellDismiss}
              onClick={() => setNotices((l) => l.filter((x) => x.id !== n.id))}
            >
              <ClearIcon />
            </button>
          </p>
        ))}
      </div>

      <section
        id="bell-timer-view"
        className="bell-timer-view"
        aria-label={labels.bellTimerHeading}
        hidden={view !== 'timer'}
        inert={Boolean(confirmation)}
      >
        <div className="bell-top">
          <button
            type="button"
            className="bell-button"
            aria-expanded={panel}
            aria-controls={panel ? 'bell-panel' : undefined}
            onClick={() => setPanel((p) => !p)}
          >
            <BellIcon />
            <span>{labels.bellBells}</span>
            <ChevronIcon />
          </button>
          <button
            type="button"
            className="bell-button"
            disabled={active}
            onClick={() =>
              chooseMode(mode === 'countdown' ? 'alarm' : 'countdown')
            }
          >
            {mode === 'countdown' ? <AlarmIcon /> : <CountdownIcon />}
            {mode === 'countdown'
              ? labels.bellModeAlarm
              : labels.bellModeCountdown}
          </button>
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
          selected={selectedMinutes}
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
            setCountdownSource('custom');
            setError(undefined);
          }}
          onAlarm={(text) => {
            setAlarmText(text);
            setAlarmPreset(undefined);
            setError(undefined);
          }}
        />

        <div className="bell-actions">
          {running ? (
            <button
              type="button"
              className="bell-button bell-button--start"
              onClick={() => setTimer(timers.pause(timer, Date.now()))}
            >
              <PauseIcon />
              {labels.bellPause}
            </button>
          ) : timer.status === 'paused' ? (
            <button
              type="button"
              className="bell-button bell-button--start"
              onClick={() => {
                void unlock();
                setTimer(timers.resume(timer, Date.now()));
              }}
            >
              <PlayIcon />
              {labels.bellResume}
            </button>
          ) : (
            <button
              type="button"
              className="bell-button bell-button--start"
              onClick={begin}
            >
              <PlayIcon />
              {labels.bellStart}
            </button>
          )}
          {mode === 'countdown' ? (
            <button
              type="button"
              className="bell-button"
              onClick={() => resetOrClear('reset')}
            >
              <ResetIcon />
              {labels.bellReset}
            </button>
          ) : (
            <button
              type="button"
              className="bell-button"
              onClick={() => resetOrClear('cleared')}
            >
              <ClearIcon />
              {labels.bellClear}
            </button>
          )}
        </div>
      </section>
      <section
        id="bell-schedule-view"
        className="bell-schedule-view"
        aria-label={labels.bellScheduleHeading}
        hidden={view !== 'schedule'}
        inert={Boolean(confirmation)}
      >
        <BellSchedule
          {...{
            labels,
            soundNames,
            bell,
            keepAwake,
            setKeepAwake,
            switchSchedule,
            unlock,
            notify,
            send,
          }}
          update={updateWeek}
          confirm={ask}
        />
      </section>

      <button
        type="button"
        className="bell-button bell-button--ring-now"
        onClick={ringNow}
        disabled={Boolean(confirmation)}
      >
        <BellIcon />
        {labels.bellRingNow}
      </button>
      <p className="bell-help">{labels.bellHelp}</p>
    </div>
  );
}
