import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setLiveClaim5kBlocklist, DEFAULT_CLAIM_5K_BLOCKED_MAKES, type Claim5kBlockRule } from '@/lib/claimLimitTiers';

export const CLAIM_5K_BLOCKLIST_KEY = 'claim_limit_5000_blocklist';

const DEFAULT_RULES: Claim5kBlockRule[] = DEFAULT_CLAIM_5K_BLOCKED_MAKES.map((make, i) => ({
  id: `default-${i}`,
  make,
  model: null,
  blocked: true,
}));

function normalise(raw: unknown): Claim5kBlockRule[] {
  if (!Array.isArray(raw)) return DEFAULT_RULES;
  const list = raw
    .filter((r: any) => r && String(r.make || '').trim())
    .map((r: any, i: number) => ({
      id: String(r.id || `rule-${i}`),
      make: String(r.make).trim(),
      model: r.model ? String(r.model).trim() : null,
      blocked: r.blocked !== false,
    }));
  return list.length ? list : DEFAULT_RULES;
}

/**
 * Managed list of vehicles blocked from the £5,000 AutoCare Premium claim limit.
 * Editable on the Price updates page, applied live to Quotes & Orders and Steps 3/4.
 */
export function useClaim5kBlocklist() {
  const [rules, setRules] = useState<Claim5kBlockRule[]>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', CLAIM_5K_BLOCKLIST_KEY)
      .maybeSingle();
    const next = normalise(data?.config_value);
    setRules(next);
    setLiveClaim5kBlocklist(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
    const channel = supabase
      .channel('claim-limit-5k-blocklist-config')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_config',
          filter: `config_key=eq.${CLAIM_5K_BLOCKLIST_KEY}`,
        },
        () => fetchRules()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRules]);

  const save = useCallback(async (next: Claim5kBlockRule[]) => {
    setSaving(true);
    const { error } = await supabase.from('admin_config').upsert(
      {
        config_key: CLAIM_5K_BLOCKLIST_KEY,
        config_value: next as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'config_key' }
    );
    setSaving(false);
    if (error) return false;
    setRules(next);
    setLiveClaim5kBlocklist(next);
    return true;
  }, []);

  return { rules, loading, saving, save, refresh: fetchRules };
}
