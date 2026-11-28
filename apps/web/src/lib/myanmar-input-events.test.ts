import { describe, expect, it } from 'vitest';
import {
  autoFixEvents,
  keysUse,
  methodChange,
  stackKeyChange,
} from './myanmar-input-events';

describe('typing events', () => {
  it('carry only fixed words and flags', () => {
    expect(methodChange('win-innwa', 'settings')).toEqual({
      name: 'input_method_change',
      data: { method: 'win-innwa', via: 'settings' },
    });
    expect(stackKeyChange(false).data).toEqual({ on: false });
    expect(keysUse('pali-dictionary', 'ligature').data).toEqual({
      app: 'pali-dictionary',
      kind: 'ligature',
    });
  });

  it('sends one event per fix in Auto, in a fixed order', () => {
    const events = autoFixEvents('pali-dictionary', 'auto', {
      fixes: ['reordered-marks', 'moved-e', 'zawgyi-converted'],
      notes: [{ code: 'unsure' }, { code: 'suggest-win-innwa' }],
    });
    expect(events.map((e) => e.data.fix)).toEqual([
      'moved-e',
      'reordered-marks',
      'zawgyi-converted',
      'unsure',
    ]);
    for (const event of events) {
      expect(event.name).toBe('input_auto_fix');
      expect(Object.keys(event.data).sort()).toEqual(['app', 'fix']);
    }
  });

  it('sends nothing for other methods or a clean text', () => {
    const fixed = { fixes: ['moved-e' as const], notes: [] };
    expect(autoFixEvents('x', 'unicode', fixed)).toEqual([]);
    expect(autoFixEvents('x', 'win-innwa', fixed)).toEqual([]);
    expect(autoFixEvents('x', 'auto', { fixes: [], notes: [] })).toEqual([]);
  });
});
