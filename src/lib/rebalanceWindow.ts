import { useCallback, useEffect, useState } from 'react';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';

/**
 * Shared date/time window for the Rebalance Leads tools.
 *
 * Default is "6pm yesterday until now". Managers can save any start date/time and
 * an optional end date/time; the choice is remembered in localStorage and broadcast
 * so the badge and the "Who is holding what" panel always agree on the same window.
 */
const STORAGE_KEY = 'rebalance_window_from';
const STORAGE_KEY_TO = 'rebalance_window_to';
const EVENT = 'rebalance-window-change';

export const getDefaultRebalanceFrom = (): Date =>
  getSince6pmYesterdayRange().from ?? new Date();

const readDate = (key: string): Date | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch {
    /* ignore */
  }
  return null;
};

export function getRebalanceFrom(): Date {
  return readDate(STORAGE_KEY) ?? getDefaultRebalanceFrom();
}

/** Optional end of the window. Null means "up to now". */
export function getRebalanceTo(): Date | null {
  return readDate(STORAGE_KEY_TO);
}

export function isRebalanceFromCustom(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY) || !!localStorage.getItem(STORAGE_KEY_TO);
  } catch {
    return false;
  }
}

export function setRebalanceWindow(from: Date | null, to: Date | null) {
  try {
    if (from) localStorage.setItem(STORAGE_KEY, from.toISOString());
    else localStorage.removeItem(STORAGE_KEY);
    if (to) localStorage.setItem(STORAGE_KEY_TO, to.toISOString());
    else localStorage.removeItem(STORAGE_KEY_TO);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function setRebalanceFrom(date: Date | null) {
  setRebalanceWindow(date, date ? getRebalanceTo() : null);
}

const ukLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** e.g. "6pm yesterday" (default), "2 Aug, 09:00" or "2 Aug, 09:00 → 3 Aug, 12:00" */
export function formatRebalanceWindowLabel(from: Date, custom: boolean, to?: Date | null) {
  if (!custom) return '6pm yesterday';
  const start = ukLabel.format(from);
  return to ? `${start} → ${ukLabel.format(to)}` : start;
}

export function useRebalanceWindow() {
  const [from, setFromState] = useState<Date>(() => getRebalanceFrom());
  const [to, setToState] = useState<Date | null>(() => getRebalanceTo());
  const [custom, setCustom] = useState<boolean>(() => isRebalanceFromCustom());

  const sync = useCallback(() => {
    setFromState(getRebalanceFrom());
    setToState(getRebalanceTo());
    setCustom(isRebalanceFromCustom());
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  return {
    from,
    to,
    custom,
    label: formatRebalanceWindowLabel(from, custom, to),
    setFrom: setRebalanceFrom,
    setWindow: setRebalanceWindow,
    reset: () => setRebalanceWindow(null, null),
  };
}
