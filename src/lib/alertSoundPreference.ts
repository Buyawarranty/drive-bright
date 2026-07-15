/**
 * Global "mute all alert sounds" preference.
 *
 * Used by every in-app pop-up that plays a beep/chime (new lead alerts,
 * open-pool arrivals, reminders, waiting-banner). One shared toggle so the
 * agent can silence everything without clicking mute on each individual card.
 *
 * Stored in localStorage as an ISO timestamp — the mute expires automatically
 * so agents don't accidentally miss alerts for a full shift.
 */

const STORAGE_KEY = 'alerts.muted_until';
const listeners = new Set<() => void>();

const now = () => Date.now();

const readUntil = (): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const t = Number(raw);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
};

const writeUntil = (t: number) => {
  try {
    if (t <= now()) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(t));
  } catch {
    // ignore quota / private-mode errors
  }
  listeners.forEach((cb) => {
    try { cb(); } catch { /* ignore */ }
  });
};

export const isAlertsMuted = (): boolean => readUntil() > now();

export const getMutedUntil = (): number => {
  const t = readUntil();
  return t > now() ? t : 0;
};

/** Mute for N minutes. Pass 0 to unmute. Pass Infinity for "until I unmute". */
export const muteAlertsFor = (minutes: number) => {
  if (!minutes || minutes <= 0) {
    writeUntil(0);
    return;
  }
  if (!Number.isFinite(minutes)) {
    // Effectively forever (100 years).
    writeUntil(now() + 100 * 365 * 24 * 60 * 60 * 1000);
    return;
  }
  writeUntil(now() + minutes * 60 * 1000);
};

export const unmuteAlerts = () => writeUntil(0);

/** Subscribe to mute-state changes. Returns an unsubscribe. */
export const subscribeAlertsMuted = (cb: () => void): (() => void) => {
  listeners.add(cb);
  // Cross-tab: react to storage events too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
};
