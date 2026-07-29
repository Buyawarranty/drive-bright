import { supabase } from '@/integrations/supabase/client';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';

/**
 * Single source of truth for "leads since 6pm yesterday".
 * Both the badge and the Quick Reassign panel read from here so their
 * numbers can never drift apart (different status filters previously made
 * the same agent show two different counts).
 */
export const SINCE_6PM_STATUS_EXCLUDE = '(lost,converted,fake_lead)';

export interface Since6pmLeadRow {
  id: string;
  assigned_to: string | null;
}

export async function fetchLeadsSince6pm(): Promise<Since6pmLeadRow[]> {
  const { from, to } = getSince6pmYesterdayRange();
  const fromIso = (from ?? new Date()).toISOString();
  const toIso = (to ?? new Date()).toISOString();

  const page = 1000;
  const all: Since6pmLeadRow[] = [];
  for (let i = 0; i < 50; i += 1) {
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, assigned_to')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .not('status', 'in', SINCE_6PM_STATUS_EXCLUDE)
      .order('id', { ascending: true })
      .range(i * page, i * page + page - 1);
    if (error || !data) break;
    all.push(...(data as Since6pmLeadRow[]));
    if (data.length < page) break;
  }
  return all;
}

export function tallyByAgent(leads: Since6pmLeadRow[]) {
  const tally = new Map<string, number>();
  let unassigned = 0;
  leads.forEach((l) => {
    if (!l.assigned_to) { unassigned += 1; return; }
    tally.set(l.assigned_to, (tally.get(l.assigned_to) || 0) + 1);
  });
  return { tally, unassigned, total: leads.length };
}
