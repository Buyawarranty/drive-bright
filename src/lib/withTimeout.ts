/**
 * Race a promise (typically a Supabase query builder's thenable) against a
 * hard timeout so an auth flow can never hang indefinitely on a stalled read.
 * Supabase query builders are thenables, not native Promises, so we wrap them
 * in Promise.resolve to keep Promise.race honest.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = 'Request'): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new TimeoutError(label, ms)), ms)),
  ]);
}
