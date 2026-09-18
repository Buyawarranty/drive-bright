import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SharkTankSettings {
  enabled: boolean;
  dry_run: boolean;
  team_ids: string[];
  hold_seconds: number;
  retry_minutes: number;
  chase_minutes: number;
}

const DEFAULTS: SharkTankSettings = {
  enabled: false,
  dry_run: true,
  team_ids: [],
  hold_seconds: 60,
  retry_minutes: 15,
  chase_minutes: 60,
};

export function useSharkTankSettings() {
  const [settings, setSettings] = useState<SharkTankSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('shark_tank_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) setSettings(data as SharkTankSettings);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<SharkTankSettings>) => {
    const next = { ...settings, ...patch };
    const { error } = await (supabase as any)
      .from('shark_tank_settings')
      .update(patch)
      .eq('id', 1);
    if (error) {
      toast.error('Could not save Open Lead Pool settings');
      return false;
    }
    setSettings(next);
    toast.success('Open Lead Pool settings saved');
    return true;
  }, [settings]);

  return { settings, loading, save, reload: load };
}

export interface SharkTankCounts {
  queued: number;
  held: number;
  retry_hold: number;
  chase_hold: number;
  claimed: number;
}

const EMPTY_COUNTS: SharkTankCounts = { queued: 0, held: 0, retry_hold: 0, chase_hold: 0, claimed: 0 };

/**
 * PERF: one shared store for every mounted `useSharkTankCounts()`.
 *
 * This hook is rendered by several panels at once, and each instance used to
 * open its own realtime channel on `sales_leads` — so every single lead write
 * triggered a full pool re-fetch per subscriber. On a busy morning that meant
 * hundreds of simultaneous requests and net::ERR_INSUFFICIENT_RESOURCES.
 *
 * Now: a single channel, a single in-flight fetch, and refreshes coalesced
 * behind a minimum interval.
 */
const REFRESH_MIN_INTERVAL_MS = 15000;

let sharedCounts: SharkTankCounts = EMPTY_COUNTS;
let subscribers = new Set<(c: SharkTankCounts) => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let inFlight: Promise<void> | null = null;
let lastLoadedAt = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

async function loadSharedCounts() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const c: SharkTankCounts = { ...EMPTY_COUNTS };

      // Count from shark_tank_pool (agents' self-serve queue)…
      const { data } = await (supabase as any).from('shark_tank_pool').select('status');
      if (data) {
        (data as { status: keyof SharkTankCounts }[]).forEach((r) => {
          if (r.status in c) c[r.status]++;
        });
      }

      // …plus any sales_leads flipped to live_open_pool that aren't yet in
      // shark_tank_pool. Counted head-only (no rows transferred), union via max
      // so overlapping rows are never double counted.
      const { count } = await (supabase as any)
        .from('sales_leads')
        .select('id', { count: 'exact', head: true })
        .eq('queue', 'live_open_pool')
        .is('assigned_to', null)
        .is('owner_agent', null)
        .not('status', 'in', '(lost,converted,fake_lead,not_eligible)')
        .or('pool_status.is.null,pool_status.in.(new,callback_booked,contacted)');
      c.queued = Math.max(c.queued, count ?? 0);

      sharedCounts = c;
      lastLoadedAt = Date.now();
      subscribers.forEach((fn) => fn(sharedCounts));
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Coalesces realtime bursts into at most one fetch per REFRESH_MIN_INTERVAL_MS. */
function scheduleSharedRefresh() {
  if (pendingTimer) return;
  const wait = Math.max(0, REFRESH_MIN_INTERVAL_MS - (Date.now() - lastLoadedAt));
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    loadSharedCounts();
  }, wait);
}

export function useSharkTankCounts() {
  const [counts, setCounts] = useState<SharkTankCounts>(sharedCounts);

  useEffect(() => {
    subscribers.add(setCounts);

    if (Date.now() - lastLoadedAt > REFRESH_MIN_INTERVAL_MS) loadSharedCounts();
    else setCounts(sharedCounts);

    if (!channel) {
      channel = supabase
        .channel(`shark_tank_pool_counts-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shark_tank_pool' }, scheduleSharedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, scheduleSharedRefresh)
        .subscribe();
    }

    return () => {
      subscribers.delete(setCounts);
      if (subscribers.size === 0) {
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingTimer = null;
        }
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    };
  }, []);

  return counts;
}

export async function sharkTankTakeNext(teamId: string) {
  const { data, error } = await (supabase as any).rpc('shark_tank_take_next', { _team_id: teamId });
  if (error) throw error;
  return data?.[0] as { lead_id: string; held_until: string } | undefined;
}

export async function sharkTankLogOutcome(
  leadId: string,
  outcome: 'answered' | 'no_answer',
  nextAction?: string,
  callReference?: string,
) {
  const { data, error } = await (supabase as any).rpc('shark_tank_log_outcome', {
    _lead_id: leadId,
    _outcome: outcome,
    _next_action: nextAction ?? null,
    _call_reference: callReference ?? null,
  });
  if (error) throw error;
  return data as string;
}
