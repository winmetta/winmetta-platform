import { describe, expect, it } from 'vitest';
import { messages } from '../../i18n/messages';
import {
  defaultEndSound,
  defaultStartSound,
  isSoundId,
  ringOffsets,
  soundById,
  sounds,
} from './sounds';

describe('sound registry', () => {
  it('has unique ids, message names in both locales and the default sounds', () => {
    expect(new Set(sounds.map((s) => s.id)).size).toBe(sounds.length);
    for (const s of sounds) {
      expect(messages.en[s.name]).toBeTruthy();
      expect(messages.my[s.name]).toBeTruthy();
    }
    expect(isSoundId(defaultStartSound)).toBe(true);
    expect(isSoundId(defaultEndSound)).toBe(true);
    expect(soundById('nope')).toBeUndefined();
  });
  it('spaces repeated strikes five seconds apart', () => {
    expect(ringOffsets(3)).toEqual([0, 5, 10]);
    expect(ringOffsets(1)).toEqual([0]);
  });
});
