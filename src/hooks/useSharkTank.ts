import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SharkTankSettings {
  enabled: boolean;
  dry_run: boolean;
  team_ids: string[];
  hold_seconds: number;
  retry_minutes: number;
  chase_minutes: number;
}

const DEFAULTS: SharkTankSettings = {
  enabled: false,
  dry_run: true,
  team_ids: [],
  hold_seconds: 60,
  retry_minutes: 15,
  chase_minutes: 60,
};

export function useSharkTankSettings() {
  const [settings, setSettings] = useState<SharkTankSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('shark_tank_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) setSettings(data as SharkTankSettings);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<SharkTankSettings>) => {
    const next = { ...settings, ...patch };
    const { error } = await (supabase as any)
      .from('shark_tank_settings')
      .update(patch)
      .eq('id', 1);
    if (error) {
      toast.error('Could not save Open Lead Pool settings');
      return false;
    }
    setSettings(next);
    toast.success('Open Lead Pool settings saved');
    return true;
  }, [settings]);

  return { settings, loading, save, reload: load };
}

export function useSharkTankCounts() {
  const [counts, setCounts] = useState({ queued: 0, held: 0, retry_hold: 0, chase_hold: 0, claimed: 0 });

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('shark_tank_pool')
      .select('status');
    if (!data) return;
    const c = { queued: 0, held: 0, retry_hold: 0, chase_hold: 0, claimed: 0 };
    (data as { status: keyof typeof c }[]).forEach(r => { if (r.status in c) c[r.status]++; });
    setCounts(c);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('shark_tank_pool_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shark_tank_pool' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return counts;
}

export async function sharkTankTakeNext(teamId: string) {
  const { data, error } = await (supabase as any).rpc('shark_tank_take_next', { _team_id: teamId });
  if (error) throw error;
  return data?.[0] as { lead_id: string; held_until: string } | undefined;
}

export async function sharkTankLogOutcome(
  leadId: string,
  outcome: 'answered' | 'no_answer',
  nextAction?: string,
  callReference?: string,
) {
  const { data, error } = await (supabase as any).rpc('shark_tank_log_outcome', {
    _lead_id: leadId,
    _outcome: outcome,
    _next_action: nextAction ?? null,
    _call_reference: callReference ?? null,
  });
  if (error) throw error;
  return data as string;
}
