import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { dayName, format12Hour } from '../../lib/meditation-bell/format';
import { days, weekdays, type Day } from '../../lib/meditation-bell/days';
import {
  addBell,
  daysOfBell,
  deleteBell,
  editBell,
  maxLabelLength,
  type Bell,
  type BellError,
} from '../../lib/meditation-bell/schedule';
import {
  bellId,
  CsvImport,
  exportSchedule,
  type ScheduleFileAction,
} from './ScheduleCsv';
import { maxCsvBellsPerDay } from '../../lib/meditation-bell/csv';
import type { BellState } from '../../lib/meditation-bell/schema';
import * as events from '../../lib/meditation-bell/events';
import { sounds } from '../../lib/meditation-bell/sounds';
import { fill, type Labels } from './labels';
import {
  BackIcon,
  DownloadIcon,
  PlusIcon,
  UploadIcon,
  VolumeIcon,
} from './icons';
import { ring } from './web-player';

export interface ScheduleConfirmation {
  message: string;
  action: string;
  confirm: () => void;
  cancel?: () => void;
}

interface DayButtonsProps {
  label: string | undefined;
  selected: readonly Day[];
  choose: (day: Day) => void;
}

function DayButtons({ label, selected, choose }: DayButtonsProps) {
  return (
    <div className="bell-days" role="group" aria-label={label}>
      {days.map((day) => (
        <button
          key={day}
          type="button"
          className="bell-choice"
          aria-label={dayName(day)}
          aria-pressed={selected.includes(day)}
          onClick={() => choose(day)}
        >
          <span className="bell-day-full">{dayName(day)}</span>
          <span className="bell-day-short">{dayName(day, 'short')}</span>
          <span className="bell-day-narrow">{dayName(day, 'narrow')}</span>
        </button>
      ))}
    </div>
  );
}

type FormError = { field: 'time' | 'days' | 'label' | 'rings'; text: string };

function describeError(error: BellError, labels: Labels): FormError {
  switch (error.kind) {
    case 'duplicate':
      return {
        field: 'time',
        text: fill(labels.bellScheduleDuplicate ?? '', {
          time: format12Hour(error.time),
          day: dayName(error.day),
        }),
      };
    case 'no-time':
    case 'invalid-time':
      return { field: 'time', text: labels.bellErrAlarmNone ?? '' };
    case 'no-day':
      return { field: 'days', text: labels.bellScheduleNeedsDay ?? '' };
    case 'label-too-long':
      return { field: 'label', text: labels.bellScheduleLongLabel ?? '' };
    case 'invalid-rings':
      return { field: 'rings', text: labels.bellScheduleInvalidRings ?? '' };
  }
}

interface EditorProps {
  labels: Labels;
  soundNames: Record<string, string>;
  initial: Omit<Bell, 'id'>;
  initialDays: Day[];
  editing: boolean;
  close: () => void;
  save: (draft: Omit<Bell, 'id'>, selected: Day[]) => FormError | undefined;
  remove: () => void;
  unlock: () => Promise<boolean>;
}

function BellEditor({
  labels,
  soundNames,
  initial,
  initialDays,
  editing,
  close,
  save,
  remove,
  unlock,
}: EditorProps) {
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState(initialDays);
  const [error, setError] = useState<FormError>();
  const back = labels.bellScheduleBack;
  const update = (next: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError(undefined);
  };
  const chooseDays = (next: Day[]) => {
    setSelected(next);
    setError(undefined);
  };
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(save({ ...draft, label: draft.label.trim() }, selected));
  };
  const showError = (field: FormError['field']) =>
    error?.field === field ? (
      <p className="bell-error" id="bell-schedule-error" role="alert">
        {error.text}
      </p>
    ) : null;

  return (
    <div className="bell-schedule-screen">
      <div className="bell-schedule-heading">
        <button
          type="button"
          className="bell-button"
          aria-label={back}
          onClick={close}
        >
          <BackIcon />
        </button>
        <h2>{editing ? labels.bellScheduleEdit : labels.bellScheduleAdd}</h2>
      </div>
      <form className="bell-schedule-form" onSubmit={submit}>
        <div className="bell-input-row">
          <label htmlFor="bell-schedule-time">{labels.bellScheduleTime}</label>
          <input
            id="bell-schedule-time"
            className="bell-field"
            type="time"
            value={draft.time}
            aria-required="true"
            aria-invalid={error?.field === 'time'}
            aria-describedby={
              error?.field === 'time' ? 'bell-schedule-error' : undefined
            }
            onChange={(event) => update({ time: event.target.value })}
          />
          {showError('time')}
        </div>
        <div className="bell-input-row">
          <label htmlFor="bell-schedule-label">
            {labels.bellScheduleLabel}
          </label>
          <input
            id="bell-schedule-label"
            className="bell-field"
            maxLength={maxLabelLength}
            value={draft.label}
            onChange={(event) => update({ label: event.target.value })}
          />
          {showError('label')}
        </div>
        <fieldset className="bell-input-row">
          <legend>{labels.bellScheduleDays}</legend>
          <DayButtons
            label={labels.bellScheduleDays}
            selected={selected}
            choose={(day) =>
              chooseDays(
                selected.includes(day)
                  ? selected.filter((item) => item !== day)
                  : [...selected, day],
              )
            }
          />
          <div className="bell-schedule-shortcuts">
            <button
              type="button"
              className="bell-button"
              onClick={() => chooseDays([...days])}
            >
              {labels.bellScheduleEveryDay}
            </button>
            <button
              type="button"
              className="bell-button"
              onClick={() => chooseDays([...weekdays])}
            >
              {labels.bellScheduleWeekdays}
            </button>
          </div>
          {showError('days')}
        </fieldset>
        <label className="bell-input-row">
          {labels.bellScheduleSound}
          <select
            className="bell-field"
            value={draft.sound}
            onChange={(event) => update({ sound: event.target.value })}
          >
            {sounds.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {soundNames[sound.id]}
              </option>
            ))}
          </select>
        </label>
        <div className="bell-input-row">
          <label htmlFor="bell-schedule-rings">{labels.bellRings}</label>
          <select
            id="bell-schedule-rings"
            className="bell-field"
            value={draft.rings}
            onChange={(event) => update({ rings: Number(event.target.value) })}
          >
            {[1, 2, 3].map((count) => (
              <option key={count} value={count}>
                {count}×
              </option>
            ))}
          </select>
          {showError('rings')}
        </div>
        <button
          type="button"
          className="bell-button"
          onClick={async () => {
            if (await unlock()) await ring(draft.sound, draft.rings);
          }}
        >
          <VolumeIcon /> {labels.bellScheduleTest}
        </button>
        <div className="bell-actions">
          <button type="submit" className="bell-button bell-button--start">
            {labels.bellScheduleSave}
          </button>
          <button type="button" className="bell-button" onClick={close}>
            {labels.bellScheduleCancel}
          </button>
        </div>
        {editing && (
          <button
            type="button"
            className="bell-button bell-button--danger"
            onClick={remove}
          >
            {labels.bellScheduleDelete}
          </button>
        )}
      </form>
    </div>
  );
}

interface Props extends ScheduleFileAction {
  bell: BellState;
  soundNames: Record<string, string>;
  keepAwake: boolean;
  setKeepAwake: (on: boolean) => void;
  switchSchedule: () => void;
  unlock: () => Promise<boolean>;
}

type Screen =
  { kind: 'list' } | { kind: 'import' } | { kind: 'edit'; bell?: Bell };

export default function BellSchedule({
  labels,
  soundNames,
  bell,
  keepAwake,
  setKeepAwake,
  switchSchedule,
  unlock,
  update,
  confirm,
  notify,
  send,
}: Props) {
  const [day, setDay] = useState<Day>('Mon');
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const requestedStorage = useRef(false);
  const { week, on } = bell.schedule;

  // This is a best-effort request, including for the first successful CSV import.
  useEffect(() => {
    if (requestedStorage.current || !days.some((day) => week[day].length))
      return;
    requestedStorage.current = true;
    void navigator.storage?.persist?.().catch(() => undefined);
  }, [week]);

  const close = () => setScreen({ kind: 'list' });

  function save(
    draft: Omit<Bell, 'id'>,
    selected: Day[],
  ): FormError | undefined {
    const original = screen.kind === 'edit' ? screen.bell : undefined;
    const next = { ...draft, id: original?.id ?? bellId() };
    const result = original
      ? editBell(week, next, selected)
      : addBell(week, next, selected);
    if ('error' in result) return describeError(result.error, labels);
    if (selected.some((day) => result.week[day].length > maxCsvBellsPerDay))
      return { field: 'days', text: labels.bellScheduleDayLimit ?? '' };
    update(result.week);
    send(events.scheduleEdit(original ? 'edit' : 'add', selected.length));
    notify(labels.bellScheduleSaved ?? '');
    if (!selected.includes(day) && selected[0]) setDay(selected[0]);
    close();
  }

  if (screen.kind === 'edit') {
    const original = screen.bell;
    return (
      <BellEditor
        labels={labels}
        soundNames={soundNames}
        initial={
          original ?? {
            time: '',
            label: '',
            sound: bell.endBell.sound,
            rings: bell.endBell.rings,
          }
        }
        initialDays={original ? daysOfBell(week, original.id) : [day]}
        editing={Boolean(original)}
        close={close}
        save={save}
        unlock={unlock}
        remove={() => {
          if (!original) return;
          confirm({
            message: labels.bellScheduleConfirmDelete ?? '',
            action: labels.bellScheduleDelete ?? '',
            confirm: () => {
              update(deleteBell(week, original.id));
              send(
                events.scheduleEdit(
                  'delete',
                  daysOfBell(week, original.id).length,
                ),
              );
              notify(labels.bellScheduleDeleted ?? '');
              close();
            },
          });
        }}
      />
    );
  }

  if (screen.kind === 'import') {
    return (
      <CsvImport
        labels={labels}
        close={close}
        week={week}
        fallbackSound={bell.endBell.sound}
        update={update}
        confirm={confirm}
        notify={notify}
        send={send}
      />
    );
  }

  return (
    <div className="bell-schedule-screen">
      <div className="bell-schedule-heading">
        <h2>{labels.bellWeeklySchedule}</h2>
        <button
          type="button"
          role="switch"
          aria-label={labels.bellWeeklySchedule}
          aria-checked={on}
          className="bell-button bell-switch"
          onClick={switchSchedule}
        >
          <span className="bell-switch-track" aria-hidden="true" />
          {on ? labels.bellScheduleOn : labels.bellOff}
        </button>
      </div>
      <DayButtons
        label={labels.bellScheduleDays}
        selected={[day]}
        choose={setDay}
      />
      <div aria-live="polite">
        {week[day].length ? (
          <ul className="bell-schedule-list">
            {week[day].map((entry) => (
              <li key={entry.id}>
                <button
                  className="bell-schedule-entry"
                  type="button"
                  onClick={() => setScreen({ kind: 'edit', bell: entry })}
                >
                  <time dateTime={entry.time}>{format12Hour(entry.time)}</time>
                  <span className="bell-entry-label">{entry.label}</span>
                  {entry.rings > 1 && (
                    <span className="bell-entry-rings">{entry.rings}×</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bell-schedule-empty">
            {fill(labels.bellScheduleEmpty ?? '', { day: dayName(day) })}
          </p>
        )}
      </div>
      <div className="bell-schedule-files">
        <button
          className="bell-button"
          type="button"
          onClick={() => setScreen({ kind: 'edit' })}
        >
          <PlusIcon />
          {labels.bellScheduleAddShort}
        </button>
        <button
          className="bell-button"
          type="button"
          onClick={() => setScreen({ kind: 'import' })}
        >
          <UploadIcon />
          {labels.bellCsvImport}
        </button>
        <button
          className="bell-button"
          type="button"
          onClick={() => exportSchedule(week, { labels, notify, send })}
        >
          <DownloadIcon />
          {labels.bellCsvExport}
        </button>
      </div>
      <label className="bell-wake">
        <input
          type="checkbox"
          role="switch"
          checked={keepAwake}
          onChange={(event) => setKeepAwake(event.target.checked)}
        />
        {labels.bellScheduleWake}
      </label>
      <p className="bell-schedule-hint">{labels.bellScheduleBackup}</p>
    </div>
  );
}
