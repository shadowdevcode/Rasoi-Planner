export function generateId(): string {
  if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    throw new Error('Secure ID generation is unavailable in this environment.');
  }
  return globalThis.crypto.randomUUID();
}
