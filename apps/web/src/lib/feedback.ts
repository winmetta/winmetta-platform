import { feedbackTypes, type FeedbackType } from './feedback-schema';
import { t, type MessageKey } from '../i18n/messages';
import type { Locale } from '../i18n/locales';

export const feedbackEnabled = import.meta.env.PUBLIC_FEEDBACK === 'true';
/** The design requires a teacher/native-reader check before post links go live. */
export const postFeedbackEnabled =
  feedbackEnabled && import.meta.env.PUBLIC_FEEDBACK_POSTS_REVIEWED === 'true';
export const feedbackTypeKeys: Record<FeedbackType, MessageKey> = {
  typo: 'feedbackTypeTypo',
  content: 'feedbackTypeContent',
  translation: 'feedbackTypeTranslation',
  other: 'feedbackTypeOther',
  time: 'feedbackTypeTime',
  zoom: 'feedbackTypeZoom',
  language: 'feedbackTypeLanguage',
  retreat: 'feedbackTypeRetreat',
  broken: 'feedbackTypeBroken',
  title: 'feedbackTypeTitle',
  suggestion: 'feedbackTypeSuggestion',
  website: 'feedbackTypeWebsite',
};
export const feedbackOptions = (locale: Locale) =>
  Object.fromEntries(
    Object.entries(feedbackTypes).map(([ctx, types]) => [
      ctx,
      types.map((type) => ({
        value: type,
        label: t(locale, feedbackTypeKeys[type]),
      })),
    ]),
  );
export function feedbackMailto(page: string, item = '', lang = ''): string {
  return `mailto:contact@winmetta.org?subject=${encodeURIComponent('[Win Metta] Feedback')}&body=${encodeURIComponent(`Page: ${page}\nItem: ${item}\nLanguage: ${lang}\n\n`)}`;
}
