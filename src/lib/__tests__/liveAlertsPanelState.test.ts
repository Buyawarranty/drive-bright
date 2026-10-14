import { describe, expect, it } from 'vitest';
import { isLiveAlertsOpen, setLiveAlertsOpen, LIVE_ALERTS_OPEN_KEY } from '@/lib/liveAlertsPanelState';

/** Minimal in-memory stand-in for sessionStorage / localStorage. */
const makeStore = (initial: Record<string, string> = {}): Storage => {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    clear: () => {
      for (const key of Object.keys(data)) delete data[key];
    },
    key: () => null,
    length: 0,
  } as Storage;
};

describe('Live Alerts panel opens by default', () => {
  it('is open when nothing has been stored yet', () => {
    expect(isLiveAlertsOpen(makeStore())).toBe(true);
  });

  it('ignores the legacy localStorage "closed" setting', () => {
    expect(isLiveAlertsOpen(makeStore({ [LIVE_ALERTS_OPEN_KEY]: '0' }))).toBe(true);
  });

  it('stays closed for the rest of the visit after closing it', () => {
    const session = makeStore();
    setLiveAlertsOpen(false, session);
    expect(isLiveAlertsOpen(session)).toBe(false);
  });

  it('reopens on a new visit even though it was closed last time', () => {
    const lastVisit = makeStore();
    setLiveAlertsOpen(false, lastVisit);
    expect(isLiveAlertsOpen(makeStore())).toBe(true);
  });

  it('clears the old permanent closed setting from localStorage when closing', () => {
    const legacy = makeStore({ [LIVE_ALERTS_OPEN_KEY]: '0' });
    setLiveAlertsOpen(false, makeStore(), legacy);
    expect(legacy.getItem(LIVE_ALERTS_OPEN_KEY)).toBeNull();
  });
});
