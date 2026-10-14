/**
 * Open/closed state for the admin "Live Alerts" panel.
 *
 * The panel must open by default on every visit — it is the section staff use
 * all the time. Closing it is a courtesy for the current visit only, so it is
 * remembered in sessionStorage (per browser tab) rather than localStorage
 * (forever). A legacy localStorage entry from when closing was permanent is
 * cleared on read so anyone who closed it in the past gets it open again.
 */
export const LIVE_ALERTS_OPEN_KEY = 'bw:live-alerts-open';

const CLOSED = '0';

export function isLiveAlertsOpen(store: Storage | undefined = sessionStorage): boolean {
  try {
    return store?.getItem(LIVE_ALERTS_OPEN_KEY) !== CLOSED;
  } catch {
    return true;
  }
}

export function setLiveAlertsOpen(
  open: boolean,
  session: Storage | undefined = sessionStorage,
  legacy?: Storage | undefined,
): void {
  try {
    session?.setItem(LIVE_ALERTS_OPEN_KEY, open ? '1' : CLOSED);
  } catch {
    /* storage unavailable — the panel still toggles for this visit */
  }
  // Remove the old permanent "closed" setting so the next visit opens again.
  try {
    legacy?.removeItem(LIVE_ALERTS_OPEN_KEY);
  } catch {
    /* ignore */
  }
}
