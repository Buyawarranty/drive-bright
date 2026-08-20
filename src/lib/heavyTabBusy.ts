/**
 * "Heavy tab busy" flag.
 *
 * Sales agents are the only staff whose dashboard runs agent-scoped pollers
 * (new-lead pop-ups, open-pool alerts, top banner). Those polls are by far the
 * heaviest reads in the database, and when an agent opens a heavy screen like
 * Quotes & Orders the tab's own queries end up queued behind them — which is
 * why only sales staff saw 90s+ loads there.
 *
 * A heavy screen marks itself busy while it boots; background pollers skip a
 * cycle instead of competing with it. Realtime pushes still arrive, so nothing
 * is missed — the poll is only a safety net.
 */
let busyCount = 0;

export const isHeavyTabBusy = (): boolean => busyCount > 0;

/** Mark a heavy screen as booting. Returns a release function. */
export function markHeavyTabBusy(maxMs = 12_000): () => void {
  busyCount += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    busyCount = Math.max(0, busyCount - 1);
  };
  const timer = setTimeout(release, maxMs);
  return () => {
    clearTimeout(timer);
    release();
  };
}
