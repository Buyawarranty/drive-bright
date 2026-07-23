import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Overnight ORR queue: leads created outside working hours (or on a weekend
 * with no roster / bank holiday) that were parked with `intake_class = 'overnight'`
 * and an `eligible_at` in the future — they'll auto-release at 09:00 on the
 * next business day.
 *
 * Consumed by:
 * - `OvernightBadge` — a row-level "Overnight – releases 09:00" chip
 * - `LeadsFilters` — an "Overnight queue (N)" filter chip
 * - `OvernightQueueBanner` — a manager-facing summary on Live Calls Data
 */
export interface OvernightQueue {
  count: number;
  nextReleaseAt: string | null;
  ids: Set<string>;
  releaseByLeadId: Map<string, string>;
}

const EMPTY: OvernightQueue = {
  count: 0,
  nextReleaseAt: null,
  ids: new Set(),
  releaseByLeadId: new Map(),
};

async function fetchOvernightQueue(): Promise<OvernightQueue> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('sales_leads')
    .select('id, eligible_at')
    .eq('intake_class', 'overnight')
    .gt('eligible_at', nowIso)
    .is('assigned_to', null)
    .not('status', 'in', '(converted,lost,fake_lead,dormant,archived)')
    .order('eligible_at', { ascending: true })
    .limit(1000);

  if (error) {
    console.warn('[useOvernightQueue] fetch failed', error);
    return EMPTY;
  }

  const ids = new Set<string>();
  const releaseByLeadId = new Map<string, string>();
  let earliest: string | null = null;

  for (const row of (data || []) as Array<{ id: string; eligible_at: string | null }>) {
    if (!row.eligible_at) continue;
    ids.add(row.id);
    releaseByLeadId.set(row.id, row.eligible_at);
    if (!earliest || row.eligible_at < earliest) earliest = row.eligible_at;
  }

  return { count: ids.size, nextReleaseAt: earliest, ids, releaseByLeadId };
}

export function useOvernightQueue() {
  return useQuery({
    queryKey: ['overnight-queue'],
    queryFn: fetchOvernightQueue,
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: EMPTY,
  });
}

/**
 * Format an eligible_at ISO string as e.g. "Mon 09:00" or "09:00" if it's later today.
 */
export function formatReleaseLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
  if (sameDay) return time;
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'Europe/London',
  });
  return `${day} ${time}`;
}
