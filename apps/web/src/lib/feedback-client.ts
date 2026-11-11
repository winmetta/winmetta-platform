import { track } from './analytics';
import { feedbackMailto } from './feedback';
import {
  isFeedbackContext,
  isFeedbackPage,
  type FeedbackContext,
} from './feedback-schema';

/** Keep Tab on the dialog's controls, including browsers that allow a stop on browser chrome. */
function containFocus(dialog: HTMLDialogElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select, textarea',
    ),
  ].filter(
    (element) =>
      !element.closest('[inert]') && element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function initFeedback(dialog: HTMLDialogElement): void {
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const select = form.querySelector<HTMLSelectElement>('select')!;
  const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!;
  const status = dialog.querySelector<HTMLElement>('[data-feedback-status]')!;
  const fallback = dialog.querySelector<HTMLAnchorElement>(
    '[data-feedback-fallback]',
  )!;
  const options = JSON.parse(dialog.dataset.options ?? '{}') as Record<
    FeedbackContext,
    { value: string; label: string }[]
  >;
  let ctx: FeedbackContext = 'general';
  let page = '';
  let item = '';
  let lang = '';
  let began = 0;
  let opener: HTMLAnchorElement | null = null;
  let pending = false;
  let readyTimer: ReturnType<typeof setTimeout>;

  function open(link: HTMLAnchorElement): boolean {
    const context = link.dataset.feedback ?? '';
    const path = link.dataset.feedbackPage ?? '';
    if (!isFeedbackContext(context) || !isFeedbackPage(path) || pending)
      return false;
    ctx = context;
    page = path;
    item = link.dataset.feedbackItem ?? '';
    lang = link.dataset.feedbackLang ?? '';
    opener = link;
    clearTimeout(readyTimer);
    form.reset();
    form.hidden = false;
    submit.disabled = true;
    status.textContent = '';
    select.replaceChildren(
      ...options[ctx].map((entry) => new Option(entry.label, entry.value)),
    );
    dialog.querySelector<HTMLElement>('[data-feedback-about]')!.textContent = [
      page,
      item,
      lang,
    ]
      .filter(Boolean)
      .join(' · ');
    fallback.href = feedbackMailto(page, item, lang);
    began = performance.now();
    // Do not silently drop an honest, quick submission through the bot heuristic.
    readyTimer = setTimeout(() => {
      submit.disabled = false;
    }, 3000);
    dialog.showModal();
    track('feedback_open', { ctx });
    return true;
  }

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[data-feedback]')
        : null;
    if (link && typeof dialog.showModal === 'function' && open(link))
      event.preventDefault();
  });
  dialog
    .querySelector('[data-feedback-close]')!
    .addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('keydown', (event) => containFocus(dialog, event));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    submit.disabled = true;
    status.textContent = dialog.dataset.sending ?? '';
    const data = new FormData(form);
    const type = String(data.get('type'));
    const payload = {
      ctx,
      type,
      page,
      item,
      lang,
      locale: dialog.dataset.locale,
      message: String(data.get('message') ?? ''),
      email: String(data.get('email') ?? ''),
      hp: String(data.get('hp') ?? ''),
      t: Math.round(performance.now() - began),
    };
    let ok = false;
    try {
      const body = JSON.stringify(payload);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(body),
      );
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-amz-content-sha256': hash,
        },
        body,
        credentials: 'omit',
        signal: AbortSignal.timeout(10000),
      });
      ok = response.status === 204;
    } catch {
      /* Keep the draft in the form and offer email. Never log it. */
    }
    track('feedback_submit', { ctx, type, ok });
    status.textContent =
      (ok ? dialog.dataset.success : dialog.dataset.error) ?? '';
    form.hidden = ok;
    if (ok) status.focus();
    pending = false;
    submit.disabled = false;
  });
}
