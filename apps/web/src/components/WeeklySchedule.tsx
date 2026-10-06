import { useEffect, useRef, useState, type ReactElement } from 'react';
import { DateTime } from 'luxon';
import { nextOccurrence, zoneView } from '../lib/class-schedule';
import {
  defaultZone,
  ianaOf,
  isZoneId,
  readZone,
  scheduleZones,
  writeZone,
  type ZoneId,
} from '../lib/schedule-zones';
import type { Locale } from '../i18n/locales';
import type { ClassSlot } from '../lib/schemas';

export interface ScheduleRow {
  id: string;
  title: string;
  titleLang: string;
  teacher: string;
  teacherLang: string;
  language: string;
  slot: ClassSlot;
  href: string;
}
export interface ScheduleLabels {
  caption: string;
  day: string;
  time: string;
  klass: string;
  language: string;
  teacher: string;
  timezone: string;
  /** Display name for each zone id. */
  zones: Record<ZoneId, string>;
}
interface Props {
  rows: ScheduleRow[];
  locale: Locale;
  labels: ScheduleLabels;
  /** Build time: used for the server HTML, then the visitor's clock takes over. */
  builtAt: string;
}

type IconName = 'day' | 'time' | 'klass' | 'teacher' | 'language';
const paths: Record<IconName, ReactElement> = {
  day: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  klass: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 21a2 2 0 0 0 2 2h13v-4M9 7h6" />
    </>
  ),
  teacher: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
};
function Heading({ icon, children }: { icon: IconName; children: string }) {
  return (
    <th scope="col">
      <span className="icon-link">
        <svg
          className="link-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          {paths[icon]}
        </svg>
        {children}
      </span>
    </th>
  );
}

// The coming week in the chosen time zone (Pacific by default). Computed in the browser so
// it follows daylight saving in every zone without a rebuild; the zone is kept in ?tz=.
export default function WeeklySchedule({
  rows,
  locale,
  labels,
  builtAt,
}: Props) {
  const [now, setNow] = useState(() => new Date(builtAt));
  const [zoneId, setZoneId] = useState<ZoneId>(defaultZone);
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    setNow(new Date());
    // A zone picked before hydration finished is kept: the URL wins, then the select's value.
    const fromUrl = new URLSearchParams(window.location.search).has('tz');
    const picked = select.current?.value;
    const id =
      fromUrl || !picked || !isZoneId(picked)
        ? readZone(window.location.search)
        : picked;
    setZoneId(id);
    if (id !== readZone(window.location.search))
      window.history.replaceState(null, '', writeZone(id, window.location));
  }, []);
  const choose = (id: ZoneId) => {
    setZoneId(id);
    window.history.replaceState(null, '', writeZone(id, window.location));
  };
  const zone = ianaOf(zoneId);
  const entries = rows
    .map((row) => {
      const next = nextOccurrence(row.slot, now);
      const local = DateTime.fromJSDate(next.start, { zone });
      return {
        row,
        view: zoneView(next, locale, zone),
        order: local.weekday * 1440 + local.hour * 60 + local.minute,
      };
    })
    .sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{labels.timezone}</span>
        <select
          ref={select}
          className="field w-auto max-w-full"
          value={zoneId}
          onChange={(event) => choose(event.target.value as ZoneId)}
        >
          {scheduleZones.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {labels.zones[entry.id]}
            </option>
          ))}
        </select>
      </label>
      <div
        className="schedule-scroll"
        role="region"
        aria-label={labels.caption}
        // Focusable so keyboard users can scroll the table sideways.
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex
        tabIndex={0}
      >
        <table className="schedule">
          <caption className="sr-only">{labels.caption}</caption>
          <thead>
            <tr>
              <Heading icon="day">{labels.day}</Heading>
              <Heading icon="time">{labels.time}</Heading>
              <Heading icon="klass">{labels.klass}</Heading>
              <Heading icon="teacher">{labels.teacher}</Heading>
              <Heading icon="language">{labels.language}</Heading>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ row, view }, index) => (
              <tr key={row.id}>
                <th scope="row">
                  {index > 0 &&
                  entries[index - 1]?.view.weekday === view.weekday ? (
                    // ။ means "same as above"; the day stays available to screen readers.
                    <>
                      <span aria-hidden="true" className="block text-center">
                        ။
                      </span>
                      <span className="sr-only">{view.weekday}</span>
                    </>
                  ) : (
                    view.weekday
                  )}
                </th>
                <td className="whitespace-nowrap">
                  {view.start}–{view.end}
                </td>
                <td>
                  <a className="link" href={row.href} lang={row.titleLang}>
                    {row.title}
                  </a>
                </td>
                <td lang={row.teacherLang}>{row.teacher}</td>
                <td>{row.language}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
