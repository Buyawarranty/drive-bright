import { useCallback, useEffect, useState } from 'react';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';

/**
 * Shared "from" time for the Rebalance Leads tools.
 *
 * Default is 6pm yesterday (the trading-day boundary). Managers can override it
 * to any date/time; the choice is remembered in localStorage and broadcast so the
 * badge and the "Who is holding what" panel always agree on the same window.
 */
const STORAGE_KEY = 'rebalance_window_from';
const EVENT = 'rebalance-window-change';

export const getDefaultRebalanceFrom = (): Date =>
  getSince6pmYesterdayRange().from ?? new Date();

export function getRebalanceFrom(): Date {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch {
    /* ignore */
  }
  return getDefaultRebalanceFrom();
}

export function isRebalanceFromCustom(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function setRebalanceFrom(date: Date | null) {
  try {
    if (date) localStorage.setItem(STORAGE_KEY, date.toISOString());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

const ukLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** e.g. "6pm yesterday" (default) or "2 Aug, 09:00" */
export function formatRebalanceWindowLabel(from: Date, custom: boolean) {
  if (!custom) return '6pm yesterday';
  return ukLabel.format(from);
}

export function useRebalanceWindow() {
  const [from, setFrom] = useState<Date>(() => getRebalanceFrom());
  const [custom, setCustom] = useState<boolean>(() => isRebalanceFromCustom());

  const sync = useCallback(() => {
    setFrom(getRebalanceFrom());
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
    custom,
    label: formatRebalanceWindowLabel(from, custom),
    setFrom: setRebalanceFrom,
    reset: () => setRebalanceFrom(null),
  };
}
