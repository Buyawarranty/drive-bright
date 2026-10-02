import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * RENEWALS ⇄ NEW LEADS SYNC
 * -------------------------------------------------------------------------
 * When an agent works a renewal from the New Leads feed (logs a call, adds a
 * quick note, changes the status, gets reassigned) that activity lives on the
 * `sales_leads` record — not on the policy. This hook pulls that live activity
 * back so the Renewals queue shows exactly the same picture as New Leads.
 *
 * Keyed by lower-cased customer email (the shared identifier between a policy
 * and its lead).
 */
export interface RenewalLeadSync {
  leadId: string;
  /** admin_users.id of the lead owner in New Leads. */
  assignedAdminId: string | null;
  status: string | null;
  callCount: number;
  lastActionAt: string | null;
  latestNote: { text: string; at: string } | null;
  /** When the lead landed in New Leads. */
  createdAt: string | null;
  lastContactedAt: string | null;
  priority: string | null;
  /** Newest-first quick notes (max 5) and total count. */
  notes: { text: string; at: string; by: string | null }[];
  noteCount: number;
}

export function useRenewalLeadSync(emails: string[]) {
  const [byEmail, setByEmail] = useState<Record<string, RenewalLeadSync>>({});
  const [loading, setLoading] = useState(false);

  const key = useMemo(
    () => Array.from(new Set(emails.map((e) => (e || '').toLowerCase()).filter(Boolean))).sort().join(','),
    [emails],
  );

  const load = useCallback(async () => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) { setByEmail({}); return; }
    setLoading(true);
    try {
      const { data: leads } = await (supabase.from('sales_leads') as any)
        .select('id, email, assigned_to, status, call_count, manual_call_adjustment, last_action_at, last_contacted_at, updated_at, notes, created_at, priority')
        .in('email', list)
        .order('updated_at', { ascending: false });

      const map: Record<string, RenewalLeadSync> = {};
      const leadIds: string[] = [];
      for (const l of ((leads as any[]) || [])) {
        const em = (l.email || '').toLowerCase();
        if (!em || map[em]) continue; // newest lead per email wins
        map[em] = {
          leadId: l.id,
          assignedAdminId: l.assigned_to ?? null,
          status: l.status ?? null,
          callCount: (l.call_count ?? 0) + (l.manual_call_adjustment ?? 0),
          lastActionAt: l.last_action_at || l.last_contacted_at || l.updated_at || null,
          latestNote: l.notes ? { text: String(l.notes), at: l.updated_at || '' } : null,
          createdAt: l.created_at ?? null,
          lastContactedAt: l.last_contacted_at ?? null,
          priority: l.priority ?? null,
          notes: [],
          noteCount: 0,
        };
        leadIds.push(l.id);
      }

      if (leadIds.length > 0) {
        const { data: notes } = await (supabase.from('lead_quick_notes') as any)
          .select('lead_id, note_text, created_at, author_name')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false });
        const byLead = new Map<string, { text: string; at: string; by: string | null }[]>();
        for (const n of ((notes as any[]) || [])) {
          const arr = byLead.get(n.lead_id) || [];
          arr.push({ text: n.note_text, at: n.created_at || '', by: n.author_name ?? null });
          byLead.set(n.lead_id, arr);
        }
        for (const em of Object.keys(map)) {
          const arr = byLead.get(map[em].leadId) || [];
          map[em] = {
            ...map[em],
            latestNote: arr[0] ? { text: arr[0].text, at: arr[0].at } : map[em].latestNote,
            notes: arr.slice(0, 5),
            noteCount: arr.length,
          };
        }
      }

      setByEmail(map);
    } catch {
      /* non-fatal — renewals still render without lead activity */
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { leadSyncByEmail: byEmail, leadSyncLoading: loading, refreshLeadSync: load };
}
