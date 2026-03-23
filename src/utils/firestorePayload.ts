export function sanitizeFirestorePayload<T extends object>(input: T): Partial<T> {
  const sanitized: Partial<T> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  });
  return sanitized;
}
