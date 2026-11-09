/**
 * Loads the Umami tracker in the browser, only when the build enabled it (the page then has the
 * #analytics-config element) and the visitor has not set Do Not Track. Also reports 404s and
 * outbound clicks. All privacy rules live in analytics.ts.
 */
import {
  cleanPayload,
  doNotTrack,
  flushQueue,
  sectionOf,
  track,
  type TrackerPayload,
} from './analytics';

const config = document.getElementById('analytics-config');
const hook = 'winmettaAnalyticsBeforeSend';

function start(el: HTMLElement) {
  const { host, websiteId, domain, notFound } = el.dataset;
  if (!host || !websiteId || !domain) return;
  if (
    doNotTrack({
      doNotTrack: navigator.doNotTrack,
      msDoNotTrack: (navigator as { msDoNotTrack?: string }).msDoNotTrack,
      windowDoNotTrack: (window as { doNotTrack?: string }).doNotTrack,
    })
  )
    return;
  const isNotFound = notFound === 'true';
  (window as unknown as Record<string, unknown>)[hook] = (
    _type: string,
    payload: TrackerPayload,
  ) => cleanPayload(payload, window.location.origin, isNotFound);
  const script = document.createElement('script');
  script.src = `${host}/script.js`;
  script.defer = true;
  script.dataset.websiteId = websiteId;
  script.dataset.hostUrl = host;
  script.dataset.domains = domain;
  script.dataset.doNotTrack = 'true';
  script.dataset.excludeSearch = 'true';
  script.dataset.excludeHash = 'true';
  script.dataset.beforeSend = hook;
  // Events sent while the script loads wait here; a failed load drops them with the queue.
  (window as unknown as Record<string, unknown>).winmettaAnalyticsQueue = [];
  script.addEventListener('load', flushQueue);
  script.addEventListener('error', () => {
    (window as unknown as Record<string, unknown>).winmettaAnalyticsQueue =
      undefined;
  });
  document.head.append(script);
  // Only the section label, never the requested path (it is typed by the visitor or a link).
  if (isNotFound)
    track('page_not_found', { section: sectionOf(window.location.pathname) });
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      // Links with their own event (data-umami-event) are counted there.
      if (link.hasAttribute('data-umami-event')) return;
      if (!/^https?:$/.test(link.protocol) || link.origin === location.origin)
        return;
      track('outbound_click', { domain: link.hostname });
    },
    true,
  );
}

if (config) start(config);
