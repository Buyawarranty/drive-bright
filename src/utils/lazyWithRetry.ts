import { lazy, type ComponentType } from 'react';

/**
 * Lazy loader that survives a flaky or stale chunk fetch.
 *
 * Why: after a deploy (or on a dropped connection) the dynamic import for a
 * heavy tab like Quotes & Orders can fail once and React.lazy caches that
 * rejection forever — the agent then sees "this section didn't open properly"
 * no matter how many times they click the tab. Here we retry the import a
 * couple of times (second attempt cache-busted) before giving up.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 500,
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
    throw lastError;
  });
}

const RELOAD_KEY = 'baw:chunk-reload-ts';

/**
 * Hard reload with the HTTP cache bypassed, used when a chunk error means the
 * browser is holding a stale index.html. Once per minute so we can't loop.
 */
export function forceFreshReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked — still attempt the reload */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}
