import { lazy, createElement, type ComponentType } from 'react';

/**
 * Lazy loader that survives a flaky or stale chunk fetch.
 *
 * Why: after a deploy (or on a dropped connection) the dynamic import for a
 * heavy tab like Quotes & Orders can fail once and React.lazy caches that
 * rejection forever — the agent then sees "this section didn't open properly"
 * no matter how many times they click the tab. Here we retry the import a
 * couple of times and, when the failure looks like a stale build, clear the
 * browser's cached copy of the app and reload so the new files are fetched.
 */

const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleBuildError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  return CHUNK_ERROR_RE.test(msg);
}

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
    // A stale build can never be fixed by retrying the same (now missing) file —
    // drop the cached app and come back on the new one.
    if (isStaleBuildError(lastError)) {
      void recoverFromStaleBuild();
    }
    throw lastError;
  });
}

const RELOAD_KEY = 'baw:chunk-reload-ts';

function canReloadNow(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked — still attempt the reload */
  }
  return true;
}

function reloadCacheBusted() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Throw away everything the browser is holding from the previous build
 * (service workers + Cache Storage), then reload cache-busted. Without this a
 * CDN/browser-cached index.html keeps pointing at deleted JS files, so a plain
 * reload lands the user straight back on the broken tab.
 */
export async function recoverFromStaleBuild() {
  if (typeof window === 'undefined') return;
  if (!canReloadNow()) return;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* ignore */
  }
  reloadCacheBusted();
}

/**
 * Hard reload with the HTTP cache bypassed, used when a chunk error means the
 * browser is holding a stale index.html. Once per minute so we can't loop.
 */
export function forceFreshReload() {
  void recoverFromStaleBuild();
}
