import { useEffect, useState } from 'react';
import { slotView } from '../lib/class-schedule';
import { soonest } from '../lib/classes';
import type { Locale } from '../i18n/locales';
import type { ClassSlot } from '../lib/schemas';

export interface NextLabels {
  next: string;
  inProgress: string;
  pacific: string;
  myanmar: string;
  nextDay: string;
}
interface Props {
  slots: ClassSlot[];
  locale: Locale;
  labels: NextLabels;
  /** Build-time moment: the server HTML and first render use it, then the visitor's clock takes over. */
  builtAt: string;
}

// Renders on the server with the build time (a readable fallback without JavaScript) and
// recomputes from the visitor's clock after hydration, so it never shows a past class.
export default function ClassNext({ slots, locale, labels, builtAt }: Props) {
  const [now, setNow] = useState(() => new Date(builtAt));
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const next = soonest(slots, now);
  if (!next) return null;
  const view = slotView(next, locale);
  return (
    <p className="text-sm">
      <span className="font-semibold">
        {next.inProgress ? labels.inProgress : labels.next}:
      </span>{' '}
      {view.pacific.weekday}, {view.pacific.date}, {view.pacific.start}–
      {view.pacific.end} {labels.pacific}
      <span className="muted">
        {' · '}
        {view.myanmar.weekday}, {view.myanmar.date}, {view.myanmar.start}–
        {view.myanmar.end} {labels.myanmar}
        {view.rollsOver ? ` ${labels.nextDay}` : ''}
      </span>
    </p>
  );
}
