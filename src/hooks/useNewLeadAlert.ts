import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';

export interface NewLeadAlertData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  assigned_at: string | null;
  status: string | null;
}

const TERMINAL_STATUSES = ['lost', 'converted', 'fake_lead', 'sale_made'];

/**
 * Returns the newest lead assigned to the current agent that has NOT yet been
 * "actioned" by them (no note added by the agent AND no call log by the agent).
 * Refetches every 20s and via realtime; the elapsed clock ticks every second.
 */
export const useNewLeadAlert = () => {
  const adminId = useCurrentAdminId();
  const [lead, setLead] = useState<NewLeadAlertData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [popupDismissedFor, setPopupDismissedFor] = useState<string | null>(null);
  const currentLeadIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!adminId) {
      setLead(null);
      return;
    }
    const { data, error } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, created_at, assigned_at, status, is_paid')
      .eq('assigned_to', adminId)
      .eq('is_paid', false)
      .order('assigned_at', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error || !data) {
      setLead(null);
      return;
    }

    const candidates = data.filter(
      (l: any) => !TERMINAL_STATUSES.includes((l.status || '').toLowerCase())
    );

    for (const l of candidates) {
      const [{ count: noteCount }, { count: callCount }] = await Promise.all([
        supabase
          .from('lead_quick_notes')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', l.id)
          .eq('created_by', adminId),
        supabase
          .from('lead_call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', l.id)
          .eq('agent_id', adminId),
      ]);
      if ((noteCount || 0) === 0 && (callCount || 0) === 0) {
        setLead(l as NewLeadAlertData);
        currentLeadIdRef.current = l.id;
        return;
      }
    }
    setLead(null);
    currentLeadIdRef.current = null;
  }, [adminId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel(`new-lead-alert-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: `assigned_to=eq.${adminId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_quick_notes', filter: `created_by=eq.${adminId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_call_logs', filter: `agent_id=eq.${adminId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId, load]);

  const elapsedMs = lead ? now - new Date(lead.created_at).getTime() : 0;

  const dismissPopup = useCallback(() => {
    if (lead) setPopupDismissedFor(lead.id);
  }, [lead]);

  const popupDismissed = !!lead && popupDismissedFor === lead.id;

  return { lead, elapsedMs, dismissPopup, popupDismissed };
};

export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
