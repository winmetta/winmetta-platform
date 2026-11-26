import { useRef, useState } from 'react';
import {
  applyImport,
  csvFileName,
  maxCsvBellsPerDay,
  maxCsvBytes,
  parseCsv,
  serializeCsv,
  type CsvResult,
  type SkipReason,
} from '../../lib/meditation-bell/csv';
import { days } from '../../lib/meditation-bell/days';
import { csv, type BellEvent } from '../../lib/meditation-bell/events';
import { dayName } from '../../lib/meditation-bell/format';
import { bellCount, type Week } from '../../lib/meditation-bell/schedule';
import type { ScheduleConfirmation } from './BellSchedule';
import { BackIcon } from './icons';
import { fill, type Labels } from './labels';

export interface ScheduleFileAction {
  labels: Labels;
  update: (week: Week) => void;
  confirm: (confirmation: ScheduleConfirmation) => void;
  notify: (message: string) => void;
  send: (event: BellEvent) => void;
}

export const bellId = () => globalThis.crypto.randomUUID();

export function exportSchedule(
  week: Week,
  {
    labels,
    notify,
    send,
  }: Pick<ScheduleFileAction, 'labels' | 'notify' | 'send'>,
) {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(
      new Blob([serializeCsv(week)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName;
    document.body.append(link);
    link.click();
    link.remove();
    send(csv('export', true, bellCount(week), false));
    notify(labels.bellCsvExported ?? '');
  } catch {
    send(csv('export', false, 0, false));
    notify(labels.bellCsvExportFailed ?? '');
  } finally {
    if (url) {
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  }
}

const reasonKey: Record<SkipReason, string> = {
  'unknown-day': 'bellCsvUnknownDay',
  'invalid-time': 'bellCsvInvalidTime',
  'invalid-rings': 'bellScheduleInvalidRings',
  'label-too-long': 'bellScheduleLongLabel',
  duplicate: 'bellCsvDuplicate',
};

const fileErrorKey = {
  'too-big': 'bellCsvTooBig',
  'too-many': 'bellCsvTooMany',
  'no-header': 'bellCsvHeader',
  empty: 'bellCsvEmpty',
  malformed: 'bellCsvMalformed',
} as const;

type Preview = Extract<CsvResult, { ok: true }>;

interface ImportProps extends ScheduleFileAction {
  close: () => void;
  fallbackSound: string;
  week: Week;
}

export function CsvImport({
  labels,
  close,
  fallbackSound,
  week,
  update,
  confirm,
  notify,
  send,
}: ImportProps) {
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const readVersion = useRef(0);

  const read = async (file: File | undefined) => {
    const version = ++readVersion.current;
    setPreview(undefined);
    setError(undefined);
    setReading(Boolean(file));
    if (!file) return;
    try {
      const result =
        file.size > maxCsvBytes
          ? ({ ok: false, error: 'too-big' } as const)
          : parseCsv(await file.text(), fallbackSound);
      if (version !== readVersion.current) return;
      if (!result.ok) {
        setError(labels[fileErrorKey[result.error]]);
        send(csv('import', false, 0, false));
        return;
      }
      setPreview(result);
      if (!result.bells.length) {
        setError(labels.bellCsvNoBells);
        send(csv('import', false, 0, result.skipped.length > 0));
      }
    } catch {
      if (version !== readVersion.current) return;
      setError(labels.bellCsvReadFailed);
      send(csv('import', false, 0, false));
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  };

  const apply = (how: 'replace' | 'add') => {
    if (!preview?.bells.length) return;
    const result = applyImport(week, preview.bells, how, bellId);
    const skipped = preview.skipped.length + result.skippedExisting;
    if (days.some((day) => result.week[day].length > maxCsvBellsPerDay)) {
      setError(labels.bellCsvTooMany);
      send(csv('import', false, 0, skipped > 0, how));
      return;
    }
    if (result.added) update(result.week);
    send(csv('import', true, result.added, skipped > 0, how));
    notify(
      fill(labels.bellCsvImported ?? '', { added: result.added, skipped }),
    );
    close();
  };

  const fallbackCount =
    preview?.bells.filter((bell) => bell.soundFallback).length ?? 0;
  return (
    <div className="bell-schedule-screen">
      <div className="bell-schedule-heading">
        <button
          type="button"
          className="bell-button"
          aria-label={labels.bellScheduleBack}
          onClick={close}
        >
          <BackIcon />
        </button>
        <h2>{labels.bellCsvImportHeading}</h2>
      </div>
      <label className="bell-input-row">
        {labels.bellCsvChoose}
        <input
          className="bell-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void read(event.target.files?.[0])}
        />
      </label>
      {reading && <p role="status">{labels.bellCsvReading}</p>}
      {error && (
        <p className="bell-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="bell-import-preview">
          <h3>{labels.bellCsvPreview}</h3>
          <dl>
            {days.map((day) => (
              <div key={day}>
                <dt>{dayName(day)}</dt>
                <dd>
                  {preview.bells.filter((bell) => bell.day === day).length}
                </dd>
              </div>
            ))}
          </dl>
          {fallbackCount > 0 && (
            <p className="bell-schedule-hint">
              {fill(labels.bellCsvFallback ?? '', { count: fallbackCount })}
            </p>
          )}
          {preview.skipped.length > 0 && (
            <details open>
              <summary>
                {fill(labels.bellCsvSkipped ?? '', {
                  count: preview.skipped.length,
                })}
              </summary>
              <ul className="bell-csv-errors">
                {preview.skipped.map(({ row, reason }) => (
                  <li key={row}>
                    {fill(labels.bellCsvRow ?? '', {
                      row,
                      reason: labels[reasonKey[reason]] ?? '',
                    })}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.bells.length > 0 && (
            <div className="bell-import-actions">
              <button
                type="button"
                className="bell-button bell-button--start"
                onClick={() => apply('add')}
              >
                {labels.bellCsvAdd}
              </button>
              <button
                type="button"
                className="bell-button"
                onClick={() =>
                  confirm({
                    message: labels.bellCsvConfirmReplace ?? '',
                    action: labels.bellCsvReplace ?? '',
                    confirm: () => apply('replace'),
                  })
                }
              >
                {labels.bellCsvReplace}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
