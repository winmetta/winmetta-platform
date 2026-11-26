// myanmar-tools 1.1.3 ships one build, for Node: its detector reads its model with
// `new Buffer(data, 'base64')`, which throws "Buffer is not defined" in a browser. This adds the
// one call it makes, only where Buffer does not exist, so Node is left untouched.

function base64Bytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// A constructor that returns an object gives `new` that object, so `new Buffer(...)` is the bytes.
function BufferShim(data: string): Uint8Array {
  return base64Bytes(data);
}

export function installBufferShim(
  target: Record<string, unknown> = globalThis as Record<string, unknown>,
): void {
  if (typeof target['Buffer'] === 'undefined') target['Buffer'] = BufferShim;
}
