import { describe, expect, it } from 'vitest';
import { defaultState, readState, writeState } from './schema';

describe('stored state', () => {
  it('starts from the defaults when nothing is stored', () => {
    expect(readState(null)).toEqual({ status: 'empty', state: defaultState() });
  });
  it('round-trips', () => {
    const state = defaultState();
    state.schedule.on = true;
    expect(readState(writeState(state))).toEqual({ status: 'ok', state });
  });
  it('keeps the raw value of anything unreadable, never deletes it', () => {
    for (const raw of ['not json', '{"version":2}', '{"version":1}', '[]']) {
      const r = readState(raw);
      expect(r).toMatchObject({ status: 'broken', raw });
      expect(r.state).toEqual(defaultState());
    }
  });
  it('rejects out-of-range values', () => {
    const state = defaultState();
    const bad = { ...state, endBell: { sound: 'x', rings: 9 } };
    expect(readState(JSON.stringify(bad)).status).toBe('broken');
  });
});
