import { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';

/**
 * Locked historical lead tile counts.
 *
 * Live tile counts recompute from the current sales_leads state, so retroactive
 * edits (reassignments, archives, fake flags, status changes) shift past-day
 * totals. A nightly cron writes an immutable snapshot into
 * public.daily_lead_stats_snapshot for each London-day. This hook returns the
 * snapshot for a single past day so the UI can display the locked numbers
 * instead of recomputing.
 *
 * Behaviour:
 * - Returns null unless dateRange is a single day whose end is strictly before
 *   the current London-date (i.e. never overrides "today").
 * - Returns null if no snapshot row exists yet (falls back to live counts).
 */
export function useDailyLeadStatsSnapshot(dateRange: DateRange | undefined) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const from = dateRange?.from;
  const to = dateRange?.to ?? dateRange?.from;

  useEffect(() => {
    let cancelled = false;

    // Only override when a SINGLE past day is selected.
    if (!from || !to) { setCounts(null); return; }
    const sameDay =
      from.getFullYear() === to.getFullYear() &&
      from.getMonth() === to.getMonth() &&
      from.getDate() === to.getDate();
    if (!sameDay) { setCounts(null); return; }

    // London-date comparison. Use en-CA locale for YYYY-MM-DD.
    const londonToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const selectedIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(from);
    if (selectedIso >= londonToday) { setCounts(null); return; }

    (async () => {
      const { data, error } = await (supabase as any)
        .from('daily_lead_stats_snapshot')
        .select('counts')
        .eq('snapshot_date', selectedIso)
        .eq('team_scope', 'all')
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.counts) { setCounts(null); return; }
      setCounts(data.counts as Record<string, number>);
    })();

    return () => { cancelled = true; };
  }, [from?.getTime(), to?.getTime()]);

  return counts;
}
