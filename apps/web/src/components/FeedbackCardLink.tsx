import { feedbackEnabled, feedbackMailto } from '../lib/feedback';
import { t } from '../i18n/messages';
import type { Locale } from '../i18n/locales';
export default function FeedbackCardLink({
  locale,
  ctx,
  item,
  page,
}: {
  locale: Locale;
  ctx: 'class' | 'library';
  item: string;
  page: string;
}) {
  return feedbackEnabled ? (
    <a
      className="link-quiet icon-link no-print relative z-10 ms-auto"
      href={feedbackMailto(page, item)}
      data-feedback={ctx}
      data-feedback-page={page}
      data-feedback-item={item}
    >
      <svg
        className="size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <path d="M4 22v-7" />
      </svg>
      {t(locale, 'feedbackProblem')}
    </a>
  ) : null;
}
