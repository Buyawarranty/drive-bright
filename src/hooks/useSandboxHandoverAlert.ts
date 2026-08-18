import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playPhoneRing, playPhoneRingBurst } from '@/lib/aiSandbox/ringTone';
import { setVisibleInterval } from '@/lib/visibilityInterval';

export type WaitingHandover = {
  id: string;
  thread_id: string;
  kind: string;
  reason: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  registration: string | null;
  cover_summary: string | null;
  quoted_price: number | null;
  created_at: string;
};

/**
 * Customers waiting in the AI sandbox chat for a human specialist.
 *
 * Anyone who can read ai_sandbox_handovers (management + admin/sales staff via
 * RLS) gets the queue. A telephone ring plays on each new arrival and keeps
 * re-ringing every 12s while someone is still waiting, so a customer sat in the
 * queue can't be missed.
 */
export function useSandboxHandoverAlert() {
  const [waiting, setWaiting] = useState<WaitingHandover[]>([]);
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const known = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_sandbox_handovers')
      .select(
        'id, thread_id, kind, reason, customer_name, customer_phone, customer_email, registration, cover_summary, quoted_price, created_at',
      )
      .eq('status', 'waiting')
      .eq('kind', 'live_handover')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return;
    const rows = (data as WaitingHandover[]) ?? [];
    const fresh = rows.filter((r) => !known.current.has(r.id));
    rows.forEach((r) => known.current.add(r.id));
    if (!firstLoad.current && fresh.length > 0 && !muted) playPhoneRingBurst(2);
    firstLoad.current = false;
    setWaiting(rows);
  }, [muted]);

  useEffect(() => {
    load();
    const stopInterval = setVisibleInterval(load, 15000);
    const channel = supabase
      .channel('ai-sandbox-handovers-alert')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_sandbox_handovers' },
        () => load(),
      )
      .subscribe();
    return () => {
      stopInterval();
      void supabase.removeChannel(channel);
    };
  }, [load]);

  // Keep ringing gently while someone is still waiting and un-dismissed.
  const visible = waiting.filter((w) => !dismissed.has(w.id));
  useEffect(() => {
    if (muted || visible.length === 0) return;
    const interval = window.setInterval(() => playPhoneRing(), 12000);
    return () => window.clearInterval(interval);
  }, [muted, visible.length]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const claim = useCallback(
    async (id: string) => {
      const { data: session } = await supabase.auth.getUser();
      await supabase
        .from('ai_sandbox_handovers')
        .update({
          status: 'accepted',
          claimed_by: session.user?.id ?? null,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', id);
      dismiss(id);
      load();
    },
    [dismiss, load],
  );

  return { waiting: visible, muted, setMuted, dismiss, claim, refresh: load };
}
