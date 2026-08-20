import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isTeamOpenNow, openingHoursLabel } from '@/lib/aiSandbox/openingHours';
import { useIsManagement } from '@/hooks/useIsManagement';

export type SpecialistPresence = {
  user_id: string;
  display_name: string | null;
  is_online: boolean;
  last_seen_at: string;
  /** Manager override: counts as live even outside opening hours. */
  override_hours?: boolean;
};

/** A specialist counts as live only if they ticked on-duty and pinged recently. */
const FRESH_MS = 3 * 60 * 1000;

const isFresh = (row: SpecialistPresence) =>
  row.is_online && Date.now() - new Date(row.last_seen_at).getTime() < FRESH_MS;

/**
 * Who is on duty right now for sandbox live handovers.
 *
 * Staff flip themselves on duty from the sandbox page; a heartbeat keeps the
 * row fresh so a closed tab drops off automatically after 3 minutes. The
 * customer-facing header uses `liveCount` to say a real specialist is
 * available rather than only quoting opening hours.
 */
export function useSandboxSpecialistPresence() {
  const [rows, setRows] = useState<SpecialistPresence[]>([]);
  const [meOnline, setMeOnline] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { isManagement } = useIsManagement();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ai_sandbox_specialist_presence')
      .select('user_id, display_name, is_online, last_seen_at, override_hours');
    const list = ((data as SpecialistPresence[]) ?? []).filter(isFresh);
    setRows(list);
    if (userId) setMeOnline(list.some((r) => r.user_id === userId));
  }, [userId]);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => { if (document.hidden) return; load(); }, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const setOnDuty = useCallback(
    async (online: boolean, displayName?: string | null) => {
      let id = userId;
      if (!id) {
        const { data } = await supabase.auth.getUser();
        id = data.user?.id ?? null;
        if (id) setUserId(id);
      }
      if (!id) {
        toast.error('Sign in again to go on duty.');
        return;
      }
      // Live agent availability is limited to opening hours (Mon–Sat, 9am–6pm UK).
      // Management can override and open live chat outside those hours.
      const outsideHours = online && !isTeamOpenNow();
      if (outsideHours && !isManagement) {
        toast.error(`Live chat is only available ${openingHoursLabel} (UK time).`);
        return;
      }
      setMeOnline(online);
      const { error } = await supabase.from('ai_sandbox_specialist_presence').upsert(
        {
          user_id: id,
          display_name: displayName ?? null,
          is_online: online,
          override_hours: outsideHours,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        setMeOnline(!online);
        toast.error(`Could not update duty status: ${error.message}`);
        return;
      }
      if (outsideHours) {
        toast.success('Manager override: live chat is open outside normal hours.');
      } else {
        toast.success(online ? 'You are on duty for live chats.' : 'You are off duty.');
      }
      load();
    },
    [userId, load, isManagement],
  );


  // Heartbeat while on duty so the presence row stays fresh.
  useEffect(() => {
    if (!meOnline || !userId) return;
    const beat = () => {
      void supabase
        .from('ai_sandbox_specialist_presence')
        .update({ last_seen_at: new Date().toISOString(), is_online: true })
        .eq('user_id', userId);
    };
    const interval = window.setInterval(() => { if (document.hidden) return; beat(); }, 60000);
    return () => window.clearInterval(interval);
  }, [meOnline, userId]);

  // Outside opening hours only manager-overridden rows count as live.
  const withinHours = isTeamOpenNow();
  const liveRows = withinHours ? rows : rows.filter((r) => r.override_hours);

  return {
    specialists: liveRows,
    liveCount: liveRows.length,
    liveNames: liveRows.map((r) => r.display_name).filter(Boolean) as string[],
    meOnline: meOnline && (withinHours || liveRows.some((r) => r.user_id === userId)),
    setOnDuty,
    canOverrideHours: isManagement,
    withinHours,
    refresh: load,
  };
}
