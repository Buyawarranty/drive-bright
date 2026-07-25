/**
 * Live call stats poller.
 *
 * The call counter on a lead row is derived server-side from real Dial 9 /
 * Zoiper events (see `recompute_sales_lead_call_count`). Those rows land in
 * the database every couple of minutes via the sync cron — but the leads list
 * only fetches once, so the counter looked "stuck" until a manual refresh.
 *
 * This module keeps a single shared 30s poll for whichever lead ids are
 * currently rendered, and pushes fresh call_count / last_contacted_at /
 * manual_call_adjustment values to the cells that asked for them.
 */

import { supabase } from '@/integrations/supabase/client';

export interface LiveCallStat {
  call_count: number;
  manual_call_adjustment: number;
  last_contacted_at: string | null;
}

type Listener = (stat: LiveCallStat) => void;

const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, LiveCallStat>();
let timer: ReturnType<typeof setInterval> | null = null;

const POLL_MS = 30_000;
const CHUNK = 200;

const sameStat = (a: LiveCallStat | undefined, b: LiveCallStat) =>
  !!a &&
  a.call_count === b.call_count &&
  a.manual_call_adjustment === b.manual_call_adjustment &&
  a.last_contacted_at === b.last_contacted_at;

const poll = async () => {
  const ids = Array.from(listeners.keys());
  if (ids.length === 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, call_count, manual_call_adjustment, last_contacted_at')
      .in('id', slice);
    if (error || !data) continue;

    for (const row of data as any[]) {
      const stat: LiveCallStat = {
        call_count: row.call_count ?? 0,
        manual_call_adjustment: row.manual_call_adjustment ?? 0,
        last_contacted_at: row.last_contacted_at ?? null,
      };
      if (sameStat(cache.get(row.id), stat)) continue;
      cache.set(row.id, stat);
      listeners.get(row.id)?.forEach((l) => {
        try { l(stat); } catch { /* ignore */ }
      });
    }
  }
};

const ensureTimer = () => {
  if (timer || typeof window === 'undefined') return;
  timer = setInterval(() => { poll().catch(() => {}); }, POLL_MS);
};

const stopTimerIfIdle = () => {
  if (timer && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
};

/** Overwrite the cached value (used after an optimistic manual +/-). */
export const primeLiveCallStat = (leadId: string, stat: LiveCallStat) => {
  cache.set(leadId, stat);
};

export const subscribeLiveCallStats = (leadId: string, cb: Listener): (() => void) => {
  if (!listeners.has(leadId)) listeners.set(leadId, new Set());
  listeners.get(leadId)!.add(cb);
  ensureTimer();

  const cached = cache.get(leadId);
  if (cached) cb(cached);

  return () => {
    const set = listeners.get(leadId);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) listeners.delete(leadId);
    stopTimerIfIdle();
  };
};
