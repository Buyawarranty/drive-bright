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
 * Subscribes to callrail_calls in real-time.
 * - Ringing banner: broadcast to every admin whose personal + team toggle is on
 *   (spans Red and Blue teams so anyone on-shift can answer).
 * - Missed-call list: still scoped to the specific assigned agent.
 */
export function useCallRailPresence() {
  const { session } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [ringing, setRinging] = useState<CallRailCall | null>(null);
  const [missed, setMissed] = useState<CallRailCall[]>([]);

  // Resolve admin_users row + team toggles for the signed-in auth user
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setAdminId(null); setBannerEnabled(false); return; }
    let cancelled = false;
    (async () => {
      const { data: admin } = await supabase
        .from('admin_users')
        .select('id, callrail_banner_enabled')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled || !admin) return;
      setAdminId(admin.id);

      // Personal opt-out short-circuits
      if (admin.callrail_banner_enabled === false) {
        setBannerEnabled(false);
        return;
      }

      // Team toggle: enabled if any of the user's teams has banner on,
      // or if the user has no team membership (managers/admins).
      const { data: memberships } = await supabase
        .from('lead_team_members')
        .select('team_id, lead_teams!inner(callrail_banner_enabled)')
        .eq('admin_user_id', admin.id);
      if (cancelled) return;
      if (!memberships || memberships.length === 0) {
        setBannerEnabled(true);
        return;
      }
      const anyTeamOn = memberships.some(
        (m: any) => m.lead_teams?.callrail_banner_enabled !== false,
      );
      setBannerEnabled(anyTeamOn);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Initial load: missed calls (scoped to me), and any current ringing call (broadcast)
  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // My missed calls
      const { data: mine } = await supabase
        .from('callrail_calls')
        .select('*')
        .eq('assigned_admin_user_id', adminId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(50);
      if (!cancelled && mine) {
        const rows = mine as CallRailCall[];
        setMissed(rows.filter(r => r.status === 'missed' && !r.acknowledged_at));
      }
      // Live ringing across all trackers (banner broadcast)
      if (bannerEnabled) {
        const { data: live } = await supabase
          .from('callrail_calls')
          .select('*')
          .eq('status', 'ringing')
          .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('started_at', { ascending: false })
          .limit(1);
        if (!cancelled && live && live[0]) setRinging(live[0] as CallRailCall);
      }
    })();
    return () => { cancelled = true; };
  }, [adminId, bannerEnabled]);

  // Realtime — missed calls scoped to me
  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel(`callrail_missed_${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'callrail_calls', filter: `assigned_admin_user_id=eq.${adminId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as CallRailCall | undefined;
          if (!row) return;
          setMissed(prev => {
            const without = prev.filter(m => m.callrail_call_id !== row.callrail_call_id);
            if (row.status === 'missed' && !row.acknowledged_at) return [row, ...without];
            return without;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId]);

  // Realtime — ringing banner broadcast (all admins with toggle on)
  useEffect(() => {
    if (!bannerEnabled) return;
    const channel = supabase
      .channel('callrail_ringing_broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'callrail_calls' },
        (payload) => {
          const row = (payload.new ?? payload.old) as CallRailCall | undefined;
          if (!row) return;
          if (row.status === 'ringing') {
            setRinging(row);
          } else {
            setRinging(prev => (prev && prev.callrail_call_id === row.callrail_call_id ? null : prev));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bannerEnabled]);

  const acknowledge = async (id: string) => {
    setMissed(prev => prev.filter(m => m.id !== id));
    await supabase
      .from('callrail_calls')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: adminId })
      .eq('id', id);
  };

  const dismissRinging = () => setRinging(null);

  return { adminId, ringing, missed, acknowledge, dismissRinging, bannerEnabled };
}
