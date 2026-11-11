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
      className="link no-print relative z-10 text-sm"
      href={feedbackMailto(page, item)}
      data-feedback={ctx}
      data-feedback-page={page}
      data-feedback-item={item}
    >
      {t(locale, 'feedbackProblem')}
    </a>
  ) : null;
}
