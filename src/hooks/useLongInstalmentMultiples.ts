import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LONG_PLAN_MULTIPLES_CONFIG_KEY,
  LONG_PLAN_MULTIPLE_DEFAULTS,
  clampLongPlanMultiple,
  getLongPlanMultiples,
  setLongPlanMultiples,
} from '@/lib/instalmentOptions';

export type LongPlanMultiples = { 24: number; 36: number };

function normalise(value: unknown): LongPlanMultiples {
  const raw = (value ?? {}) as Record<string, unknown>;
  const read = (key: '24' | '36') => {
    const n = Number(raw[key]);
    return Number.isFinite(n) && n > 0
      ? clampLongPlanMultiple(Number(key) as 24 | 36, n)
      : LONG_PLAN_MULTIPLE_DEFAULTS[Number(key) as 24 | 36];
  };
  return { 24: read('24'), 36: read('36') };
}

/**
 * Manager-editable multiples used to price the 24 and 36 instalment plans off the
 * 1-year price. Saved in admin_config and applied live to Quotes & Orders,
 * Confirm external payment and the price-model test page.
 */
export function useLongInstalmentMultiples() {
  const [multiples, setMultiples] = useState<LongPlanMultiples>(getLongPlanMultiples());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMultiples = useCallback(async () => {
    const { data } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', LONG_PLAN_MULTIPLES_CONFIG_KEY)
      .maybeSingle();
    const next = normalise(data?.config_value);
    setLongPlanMultiples(next);
    setMultiples(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMultiples();
    const channel = supabase
      .channel('long-instalment-plan-multiples')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_config',
          filter: `config_key=eq.${LONG_PLAN_MULTIPLES_CONFIG_KEY}`,
        },
        () => void fetchMultiples()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMultiples]);

  const save = useCallback(async (next: LongPlanMultiples) => {
    const clean = normalise(next);
    setSaving(true);
    const { error } = await supabase.from('admin_config').upsert(
      {
        config_key: LONG_PLAN_MULTIPLES_CONFIG_KEY,
        config_value: clean as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'config_key' }
    );
    setSaving(false);
    if (error) return false;
    setLongPlanMultiples(clean);
    setMultiples(clean);
    return true;
  }, []);

  return { multiples, loading, saving, save, refresh: fetchMultiples, defaults: LONG_PLAN_MULTIPLE_DEFAULTS };
}
