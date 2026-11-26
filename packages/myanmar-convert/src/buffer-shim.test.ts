import { describe, expect, it } from 'vitest';
import { installBufferShim } from './buffer-shim.ts';

describe('installBufferShim', () => {
  it('gives `new Buffer(base64, "base64")` the decoded bytes where Buffer is missing', () => {
    const target: Record<string, unknown> = {};
    installBufferShim(target);
    const Shim = target['Buffer'] as new (
      data: string,
      encoding: string,
    ) => Uint8Array;
    const bytes = new Shim('AQID/w==', 'base64');
    expect([...bytes]).toEqual([1, 2, 3, 255]);
    expect(bytes.length).toBe(4);
  });

  it('leaves an existing Buffer alone', () => {
    const existing = class {};
    const target: Record<string, unknown> = { Buffer: existing };
    installBufferShim(target);
    expect(target['Buffer']).toBe(existing);
  });
});
