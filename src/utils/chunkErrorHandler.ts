/**
 * Chunk load error recovery.
 *
 * When we deploy a new build, users who already have the old `index.html`
 * open (or cached) reference JS chunks with the previous content hash.
 * Those files no longer exist on the CDN, so the dynamic import throws
 * a "Failed to fetch dynamically imported module" / ChunkLoadError and
 * the page appears blank / stuck.
 *
 * Strategy: detect the error, then force a one-time hard reload so the
 * browser fetches a fresh `index.html` (which points at the new chunks).
 * A sessionStorage flag prevents infinite reload loops if the failure is
 * caused by something other than a stale deploy.
 */

const RELOAD_FLAG = 'baw:chunk-reload-attempted';
const RELOAD_TS_KEY = 'baw:chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
];

const isChunkError = (msg?: string | null): boolean => {
  if (!msg) return false;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(msg));
};

const forceReloadOnce = () => {
  try {
    const now = Date.now();
    const lastTs = Number(sessionStorage.getItem(RELOAD_TS_KEY) || '0');

    // If we reloaded very recently and still hit a chunk error, stop —
    // otherwise the user gets stuck in a refresh loop.
    if (sessionStorage.getItem(RELOAD_FLAG) === '1' && now - lastTs < RELOAD_COOLDOWN_MS) {
      console.error('[chunk-recovery] Already reloaded once, aborting to avoid loop.');
      return;
    }

    sessionStorage.setItem(RELOAD_FLAG, '1');
    sessionStorage.setItem(RELOAD_TS_KEY, String(now));
  } catch {
    // sessionStorage may be blocked (private mode, iframes) — still try to reload.
  }

  // Bust the HTTP cache: append a version query so the browser doesn't
  // serve a stale index.html from disk cache.
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
};

export const initChunkErrorHandler = () => {
  if (typeof window === 'undefined') return;

  // Clear the reload flag once the app has been running for a bit — this
  // way the next unrelated chunk error in a future session can also self-heal.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
      sessionStorage.removeItem(RELOAD_TS_KEY);
    } catch {}
  }, 15_000);

  window.addEventListener('error', (event) => {
    const msg = event?.message || (event?.error && String(event.error?.message));
    if (isChunkError(msg)) {
      console.warn('[chunk-recovery] Stale chunk detected, reloading:', msg);
      forceReloadOnce();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message;
    if (isChunkError(msg)) {
      console.warn('[chunk-recovery] Stale chunk (promise) detected, reloading:', msg);
      forceReloadOnce();
    }
  });
};
