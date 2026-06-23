import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the set of additional team_ids a sales_lead admin user has been
 * granted visibility into (on top of their own team). Empty array means
 * "no extra teams granted" — the sales_lead stays locked to their own team.
 *
 * Management (admin / super_admin / sales_manager) toggles these grants from
 * the Lead Allocation page. The reader policy lets the sales_lead read their
 * own grants so the chip row can unlock client-side.
 */
export function useSalesLeadTeamVisibility(adminUserId: string | null) {
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!adminUserId) {
      setTeamIds([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('sales_lead_team_visibility')
      .select('team_id')
      .eq('admin_user_id', adminUserId);
    if (!error) {
      setTeamIds((data || []).map((r: any) => r.team_id));
    }
    setLoading(false);
  }, [adminUserId]);

  useEffect(() => { load(); }, [load]);

  return { teamIds, loading, refresh: load };
}

/**
 * Fetch grants for many sales_leads at once (used by the management panel).
 */
export function useAllSalesLeadTeamVisibility() {
  const [byAgent, setByAgent] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_lead_team_visibility')
      .select('admin_user_id, team_id');
    if (!error) {
      const m = new Map<string, Set<string>>();
      for (const row of (data || []) as any[]) {
        const set = m.get(row.admin_user_id) ?? new Set<string>();
        set.add(row.team_id);
        m.set(row.admin_user_id, set);
      }
      setByAgent(m);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { byAgent, loading, refresh: load };
}
