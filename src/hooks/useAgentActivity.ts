import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Last time a HUMAN agent actually touched a lead.
 *
 * `sales_leads.last_contacted_at` only moves when someone explicitly marks the
 * lead contacted, so leads that were quoted / had their status changed / had a
 * note written still showed "No agent activity". This hook merges the real
 * human signals:
 *   - lead_quick_notes (created_by set = written by an agent)
 *   - lead_call_logs   (any logged call)
 *   - sales_leads_changelog (status changed by a real user)
 */

export interface AgentActivity {
  lastAt: string;
  source: 'note' | 'call' | 'status';
}

const SOURCE_LABEL: Record<AgentActivity['source'], string> = {
  note: 'Note added',
  call: 'Call logged',
  status: 'Status changed',
};

export const getAgentActivityLabel = (s: AgentActivity['source']) => SOURCE_LABEL[s];

const BATCH = 200;

export const useAgentActivity = (leadIds: string[]) => {
  const [activityByLead, setActivityByLead] = useState<Record<string, AgentActivity>>({});
  const lastKeyRef = useRef('');

  const ids = useMemo(() => [...new Set(leadIds.filter(Boolean))].sort(), [leadIds]);
  const key = useMemo(
    () => (ids.length ? `${ids.length}:${ids[0]}:${ids[ids.length - 1]}` : ''),
    [ids]
  );

  const fetchAll = useCallback(async () => {
    if (!key || lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const merged: Record<string, AgentActivity> = {};
    const upsert = (leadId: string, at: string | null, source: AgentActivity['source']) => {
      if (!leadId || !at) return;
      const existing = merged[leadId];
      if (!existing || new Date(at).getTime() > new Date(existing.lastAt).getTime()) {
        merged[leadId] = { lastAt: at, source };
      }
    };

    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const [notes, calls, changes] = await Promise.all([
          supabase
            .from('lead_quick_notes')
            .select('lead_id, created_at, created_by')
            .in('lead_id', batch)
            .not('created_by', 'is', null)
            .order('created_at', { ascending: false })
            .limit(batch.length * 3),
          supabase
            .from('lead_call_logs')
            .select('lead_id, created_at')
            .in('lead_id', batch)
            .order('created_at', { ascending: false })
            .limit(batch.length * 3),
          supabase
            .from('sales_leads_changelog')
            .select('lead_id, changed_at, changed_by, old_status, new_status')
            .in('lead_id', batch)
            .not('changed_by', 'is', null)
            .order('changed_at', { ascending: false })
            .limit(batch.length * 5),
        ]);

        (notes.data || []).forEach((r: any) => upsert(r.lead_id, r.created_at, 'note'));
        (calls.data || []).forEach((r: any) => upsert(r.lead_id, r.created_at, 'call'));
        (changes.data || []).forEach((r: any) => {
          if (!r.new_status || r.old_status === r.new_status) return;
          upsert(r.lead_id, r.changed_at, 'status');
        });
      }
      setActivityByLead(merged);
    } catch (e) {
      console.error('useAgentActivity error', e);
    }
  }, [key, ids]);

  useEffect(() => {
    if (!key) return;
    const t = setTimeout(fetchAll, 600);
    return () => clearTimeout(t);
  }, [key, fetchAll]);

  return { activityByLead };
};
