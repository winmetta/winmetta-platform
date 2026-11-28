import { describe, expect, it } from 'vitest';
import { messages, t } from '../i18n/messages';
import { inputLabels, noticeLines } from './myanmar-input-view';

const en = inputLabels((key) => t('en', key));
const my = inputLabels((key) => t('my', key));

describe('noticeLines', () => {
  it('says each fix, then the notes', () => {
    expect(
      noticeLines(
        {
          fixes: ['moved-e', 'zawgyi-converted'],
          notes: [{ code: 'unsure' }],
        },
        en,
      ),
    ).toEqual([
      'Moved ေ after the consonant.',
      'Converted from Zawgyi to Unicode.',
      'Not sure if this is Unicode or Zawgyi. Using Unicode.',
    ]);
  });

  it('fills the unmapped letters and skips notes the field does not show', () => {
    expect(
      noticeLines(
        {
          fixes: [],
          notes: [
            { code: 'unmapped', chars: ['္သ', 'ꩡ'] },
            { code: 'latin-in-win-innwa' },
          ],
        },
        en,
      ),
    ).toEqual([
      'These letters have no Win Innwa glyph and were kept as Unicode: ္သ ꩡ',
    ]);
  });

  it('has a line for every fix in both languages', () => {
    for (const labels of [en, my])
      for (const line of Object.values(labels.fixes)) expect(line).toBeTruthy();
  });

  it('keeps the placeholders the field fills', () => {
    for (const locale of ['en', 'my'] as const) {
      expect(messages[locale].inputShownIn).toContain('{font}');
      expect(messages[locale].inputUsing).toContain('{text}');
      expect(messages[locale].inputNoteUnmapped).toContain('{chars}');
    }
  });
});
