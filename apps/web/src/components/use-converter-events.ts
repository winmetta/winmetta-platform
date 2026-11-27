// Sends the converter events that follow what the page shows rather than a click: the first
// conversion in a page view, and a conversion that could not run (docs/myanmar-converter.md §11).
import { useEffect, useRef } from 'react';
import type { Encoding } from '@winmetta/myanmar-convert';
import { track } from '../lib/analytics';
import type { FromChoice, View } from '../lib/text-converter';
import * as events from '../lib/text-converter-events';

export function send(event: events.ConverterEvent): void {
  track(event.name, event.data);
}

export function useConverterEvents(
  view: View | null,
  from: FromChoice,
  to: Encoding,
  chars: number,
): void {
  const converted = useRef(false);
  const issue = view?.issue ?? null;
  const hasOutput = Boolean(view?.output);
  useEffect(() => {
    if (!hasOutput || converted.current) return;
    converted.current = true;
    send(events.convert(from, to, chars));
  }, [hasOutput, from, to, chars]);
  useEffect(() => {
    if (issue) send(events.issue(issue));
  }, [issue]);
}
