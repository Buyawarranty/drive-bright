import { supabase } from '@/integrations/supabase/client';
import { getSince6pmYesterdayRange } from '@/lib/leadFeedDate';
import { hasAgentWrittenNotesField, isAutomatedLeadNote } from '@/lib/leadNoteLock';

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
  created_at?: string | null;
  /**
   * True when the lead has been touched at all (call logged, contact time,
   * status moved on). Kept for reporting — a call or status change on its own
   * no longer blocks a reassign.
   */
  worked?: boolean;
  /**
   * True when an agent has WRITTEN A NOTE on the lead. Note-locked leads can
   * only be reassigned once a manager has checked with the agent and ticked
   * the authorisation box.
   */
  noteLocked?: boolean;
}

export async function fetchLeadsSince6pm(fromOverride?: Date, toOverride?: Date | null): Promise<Since6pmLeadRow[]> {
  const { from, to } = getSince6pmYesterdayRange();
  const fromIso = (fromOverride ?? from ?? new Date()).toISOString();
  const toIso = toOverride
    ? toOverride.toISOString()
    : new Date(Math.max((to ?? new Date()).getTime(), Date.now())).toISOString();



  const page = 1000;
  const all: Since6pmLeadRow[] = [];
  for (let i = 0; i < 50; i += 1) {
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, assigned_to, created_at, call_count, manual_call_adjustment, last_contacted_at, notes, owner_agent, status')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .not('status', 'in', SINCE_6PM_STATUS_EXCLUDE)
      .order('id', { ascending: true })
      .range(i * page, i * page + page - 1);
    if (error || !data) break;
    all.push(
      ...(data as any[]).map((r) => ({
        id: r.id as string,
        assigned_to: (r.assigned_to ?? null) as string | null,
        created_at: (r.created_at ?? null) as string | null,
        worked:
          (r.call_count ?? 0) > 0 ||
          (r.manual_call_adjustment ?? 0) > 0 ||
          !!r.last_contacted_at ||
          !!(r.notes && String(r.notes).trim()) ||
          !!r.owner_agent ||
          (!!r.status && r.status !== 'new'),
        noteLocked: hasAgentWrittenNotesField(r.notes),
      })),
    );
    if (data.length < page) break;
  }

  // Quick notes live in their own table — an agent-written note there locks the
  // lead too. System notes (arrival stamp, "Status changed: …") do not.
  const ids = all.map((l) => l.id);
  const noted = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const { data } = await supabase
      .from('lead_quick_notes')
      .select('lead_id, note_text, created_by')
      .in('lead_id', slice);
    (data ?? []).forEach((n: any) => {
      if (!isAutomatedLeadNote(n.note_text, n.created_by)) noted.add(n.lead_id);
    });
  }
  if (noted.size > 0) {
    all.forEach((l) => {
      if (noted.has(l.id)) {
        l.worked = true;
        l.noteLocked = true;
      }
    });
  }

  return all;
}

export function tallyByAgent(leads: Since6pmLeadRow[]) {
  const tally = new Map<string, number>();
  const movable = new Map<string, number>();
  const noteLocked = new Map<string, number>();
  let unassigned = 0;
  leads.forEach((l) => {
    if (!l.assigned_to) { unassigned += 1; return; }
    tally.set(l.assigned_to, (tally.get(l.assigned_to) || 0) + 1);
    if (l.noteLocked) {
      noteLocked.set(l.assigned_to, (noteLocked.get(l.assigned_to) || 0) + 1);
    } else {
      movable.set(l.assigned_to, (movable.get(l.assigned_to) || 0) + 1);
    }
  });
  return { tally, movable, noteLocked, unassigned, total: leads.length };
}

