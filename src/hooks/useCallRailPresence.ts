import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CallRailCall {
  id: string;
  callrail_call_id: string;
  direction: string;
  status: string;
  caller_number: string | null;
  caller_name: string | null;
  caller_city: string | null;
  caller_state: string | null;
  tracked_number: string | null;
  assigned_admin_user_id: string | null;
  matched_lead_id: string | null;
  matched_customer_id: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  acknowledged_at: string | null;
}

/**
 * Subscribes to callrail_calls in real-time and surfaces the current
 * ringing call (if any) and the list of unacknowledged missed calls
 * routed to the signed-in admin.
 */
export function useCallRailPresence() {
  const { session } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [ringing, setRinging] = useState<CallRailCall | null>(null);
  const [missed, setMissed] = useState<CallRailCall[]>([]);

  // Resolve admin_users.id for the signed-in auth user
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setAdminId(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();
      if (!cancelled) setAdminId(data?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Initial load: ringing + unacknowledged missed
  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('callrail_calls')
        .select('*')
        .eq('assigned_admin_user_id', adminId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      const rows = data as CallRailCall[];
      setRinging(rows.find(r => r.status === 'ringing') ?? null);
      setMissed(rows.filter(r => r.status === 'missed' && !r.acknowledged_at));
    })();
    return () => { cancelled = true; };
  }, [adminId]);

  // Realtime subscription
  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel(`callrail_calls_${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'callrail_calls', filter: `assigned_admin_user_id=eq.${adminId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as CallRailCall | undefined;
          if (!row) return;

          if (row.status === 'ringing') {
            setRinging(row);
          } else if (ringing && row.callrail_call_id === ringing.callrail_call_id) {
            setRinging(null);
          }

          setMissed(prev => {
            const without = prev.filter(m => m.callrail_call_id !== row.callrail_call_id);
            if (row.status === 'missed' && !row.acknowledged_at) {
              return [row, ...without];
            }
            return without;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  const acknowledge = async (id: string) => {
    setMissed(prev => prev.filter(m => m.id !== id));
    await supabase
      .from('callrail_calls')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: adminId })
      .eq('id', id);
  };

  const dismissRinging = () => setRinging(null);

  return { adminId, ringing, missed, acknowledge, dismissRinging };
}
