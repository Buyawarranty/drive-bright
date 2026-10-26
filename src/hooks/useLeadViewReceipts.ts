import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadViewReceipt {
  lead_id: string;
  viewer_id: string;
  first_viewed_at: string;
  last_viewed_at: string;
}

/**
 * WhatsApp-style "seen" receipts for leads.
 *
 * - `markLeadSeen` records that the current staff member opened a lead. The
 *   server function refuses to write for anyone but the caller's own active
 *   staff account, so receipts can't be forged.
 * - `receiptsByLead` is readable by management only (RLS), so sales staff
 *   never load or see who viewed what.
 */
export function useLeadViewReceipts(leadIds: string[], enabled: boolean) {
  const [receipts, setReceipts] = useState<LeadViewReceipt[]>([]);

  const key = useMemo(() => leadIds.slice().sort().join(','), [leadIds]);

  useEffect(() => {
    if (!enabled || leadIds.length === 0) {
      setReceipts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('lead_view_receipts')
        .select('lead_id, viewer_id, first_viewed_at, last_viewed_at')
        .in('lead_id', leadIds);
      if (!cancelled) setReceipts(error ? [] : (data || []) as LeadViewReceipt[]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const receiptsByLead = useMemo(() => {
    const map = new Map<string, LeadViewReceipt[]>();
    for (const r of receipts) {
      const list = map.get(r.lead_id);
      if (list) list.push(r);
      else map.set(r.lead_id, [r]);
    }
    return map;
  }, [receipts]);

  const markLeadSeen = useCallback(async (leadId: string, viewerId: string | null) => {
    if (!viewerId) return;
    // Fire-and-forget: a failed receipt must never block opening a lead.
    try {
      await supabase.rpc('mark_lead_seen', { _lead_id: leadId, _viewer_id: viewerId });
      const now = new Date().toISOString();
      setReceipts((prev) => {
        const idx = prev.findIndex((r) => r.lead_id === leadId && r.viewer_id === viewerId);
        if (idx === -1) {
          return [...prev, { lead_id: leadId, viewer_id: viewerId, first_viewed_at: now, last_viewed_at: now }];
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], last_viewed_at: now };
        return copy;
      });
    } catch {
      /* receipt is best-effort */
    }
  }, []);

  return { receiptsByLead, markLeadSeen };
}
