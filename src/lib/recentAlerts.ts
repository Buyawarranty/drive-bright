/**
 * Browser-local log of alerts the user has closed, shown as "Recent alerts"
 * in the Live Alerts panel. Display only — closing an entry here never
 * changes the underlying lead, payment or chat.
 */
export type RecentAlertTone = 'red' | 'blue' | 'amber' | 'green' | 'orange' | 'emerald';
export interface RecentAlert {
  key: string;
  title: string;
  detail: string;
  tone: RecentAlertTone;
  at: number;
}

const KEY = 'bw:recent-alerts';
const EVENT = 'bw-recent-alerts-change';
const MAX = 30;
const TTL = 24 * 3600 * 1000;

export const readRecentAlerts = (): RecentAlert[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]') as RecentAlert[];
    const cutoff = Date.now() - TTL;
    return list.filter((a) => a.at >= cutoff);
  } catch {
    return [];
  }
};

const write = (list: RecentAlert[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
};

export const pushRecentAlert = (a: Omit<RecentAlert, 'at'>) => {
  const list = readRecentAlerts().filter((x) => x.key !== a.key);
  write([{ ...a, at: Date.now() }, ...list]);
};

export const removeRecentAlert = (key: string) => write(readRecentAlerts().filter((x) => x.key !== key));

export const RECENT_ALERTS_EVENT = EVENT;
