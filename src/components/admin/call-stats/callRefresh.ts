export const CALL_STATS_REFRESH_MS = 30_000;

/** One visible-page request at a time; returning from the dialler triggers a fresh read. */
export function startCallRefresh(read: () => Promise<void>, visibility: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document) {
  let disposed = false;
  let running = false;
  const refresh = async () => {
    if (disposed || running || visibility.visibilityState !== 'visible') return;
    running = true;
    try { await read(); } finally { running = false; }
  };
  const initial = setTimeout(() => void refresh(), 250);
  const interval = setInterval(() => void refresh(), CALL_STATS_REFRESH_MS);
  const visible = () => void refresh();
  visibility.addEventListener('visibilitychange', visible);
  return { refresh, stop: () => {
    disposed = true;
    clearTimeout(initial);
    clearInterval(interval);
    visibility.removeEventListener('visibilitychange', visible);
  } };
}