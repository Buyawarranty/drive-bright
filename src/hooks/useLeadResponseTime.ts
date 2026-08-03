import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * "Time to contact" — how long after a lead arrived did an agent first act on it.
 *
 * First action = earliest of:
 *   - lead_call_logs (Zoiper / Dial 9 logged call)
 *   - lead_quick_notes written by a human
 *   - sales_leads_changelog status change made by a real user
 *
 * This feeds both the Time to contact column on the leads table and the
 * response-time stats on the Live Calls Data page.
 */

export interface LeadResponseTime {
  /** ISO timestamp of the first human action on the lead. */
  firstActionAt: string;
  source: 'call' | 'note' | 'status';
  /** Seconds between lead arrival and the first action. */
  seconds: number;
}

const SOURCE_LABEL: Record<LeadResponseTime['source'], string> = {
  call: 'First call',
  note: 'First note',
  status: 'Status change',
};

export const getResponseSourceLabel = (s: LeadResponseTime['source']) => SOURCE_LABEL[s];

/** "45s", "3m 12s", "2h 5m", "1d 4h". */
export const formatResponseTime = (sec: number | null | undefined): string => {
  if (sec == null || sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

/** Target is 120 seconds — green inside, amber to 10m, red beyond. */
export const responseTone = (sec: number | null | undefined): string => {
  if (sec == null) return 'text-muted-foreground';
  if (sec <= 120) return 'text-emerald-700';
  if (sec <= 600) return 'text-amber-700';
  return 'text-rose-700';
};

const BATCH = 200;

interface LeadInput {
  id: string;
  created_at: string;
}

export const useLeadResponseTime = (leads: LeadInput[]) => {
  const [responseByLead, setResponseByLead] = useState<Record<string, LeadResponseTime>>({});
  const lastKeyRef = useRef('');

  const createdById = useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach(l => { if (l?.id && l.created_at) map[l.id] = l.created_at; });
    return map;
  }, [leads]);

  const ids = useMemo(() => Object.keys(createdById).sort(), [createdById]);
  const key = useMemo(
    () => (ids.length ? `${ids.length}:${ids[0]}:${ids[ids.length - 1]}` : ''),
    [ids]
  );

  const fetchAll = useCallback(async () => {
    if (!key || lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const first: Record<string, { at: string; source: LeadResponseTime['source'] }> = {};
    const consider = (leadId: string, at: string | null, source: LeadResponseTime['source']) => {
      if (!leadId || !at || !createdById[leadId]) return;
      const existing = first[leadId];
      if (!existing || new Date(at).getTime() < new Date(existing.at).getTime()) {
        first[leadId] = { at, source };
      }
    };

    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const [calls, notes, changes] = await Promise.all([
          supabase
            .from('lead_call_logs')
            .select('lead_id, created_at')
            .in('lead_id', batch)
            .order('created_at', { ascending: true })
            .limit(batch.length * 5),
          supabase
            .from('lead_quick_notes')
            .select('lead_id, created_at, created_by')
            .in('lead_id', batch)
            .not('created_by', 'is', null)
            .order('created_at', { ascending: true })
            .limit(batch.length * 5),
          supabase
            .from('sales_leads_changelog')
            .select('lead_id, changed_at, changed_by, old_status, new_status')
            .in('lead_id', batch)
            .not('changed_by', 'is', null)
            .order('changed_at', { ascending: true })
            .limit(batch.length * 5),
        ]);

        (calls.data || []).forEach((r: any) => consider(r.lead_id, r.created_at, 'call'));
        (notes.data || []).forEach((r: any) => consider(r.lead_id, r.created_at, 'note'));
        (changes.data || []).forEach((r: any) => {
          if (!r.new_status || r.old_status === r.new_status) return;
          consider(r.lead_id, r.changed_at, 'status');
        });
      }

      const out: Record<string, LeadResponseTime> = {};
      Object.entries(first).forEach(([leadId, v]) => {
        const createdAt = createdById[leadId];
        const seconds = Math.max(
          0,
          Math.round((new Date(v.at).getTime() - new Date(createdAt).getTime()) / 1000)
        );
        out[leadId] = { firstActionAt: v.at, source: v.source, seconds };
      });
      setResponseByLead(out);
    } catch (e) {
      console.error('useLeadResponseTime error', e);
    }
  }, [key, ids, createdById]);

  useEffect(() => {
    if (!key) return;
    const t = setTimeout(fetchAll, 600);
    return () => clearTimeout(t);
  }, [key, fetchAll]);

  return { responseByLead };
};
