import { isLocale } from './locales';
import { track } from '../lib/analytics';
import { switchLocale, saveLocalePreference } from './routes';
// Only the locale segment may change; path, query and fragment come from the
// current URL, which can change after load (hash links, history.replaceState).
const links = document.querySelectorAll<HTMLAnchorElement>('a[data-locale]');
function refresh(link: HTMLAnchorElement, code: string) {
  if (isLocale(code))
    link.href = switchLocale(new URL(window.location.href), code);
}
links.forEach((link) => {
  const code = link.dataset.locale;
  if (!code || !isLocale(code)) return;
  const update = () => refresh(link, code);
  update();
  window.addEventListener('hashchange', update);
  window.addEventListener('popstate', update);
  // Refresh at activation time, including keyboard and modified clicks.
  for (const type of ['pointerdown', 'focus', 'mouseenter', 'click'])
    link.addEventListener(type, update);
  link.addEventListener('click', () => {
    saveLocalePreference(code);
    if (document.documentElement.lang !== code)
      track('locale_switch', {
        from: document.documentElement.lang,
        to: code,
      });
  });
});
