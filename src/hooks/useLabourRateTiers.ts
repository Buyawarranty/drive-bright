import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getLabourRateOptions,
  setLiveLabourRateFactors,
  PRICING_UPDATED_EVENT,
  type LabourRateOption,
} from '@/lib/pricingMatrix';

export interface LabourRateTiers {
  /** Currently published (live) labour-rate tiers. */
  current: LabourRateOption[];
  /** Rates that appeared in any earlier pricing version but are no longer live. */
  retired: number[];
  /** Formats a purchased labour rate, flagging retired/unknown historic tiers. */
  format: (rate: number) => string;
}

/**
 * Keeps labour-rate tiers in sync with Admin → Price updates without a reload.
 * Refreshes on: live pricing override changes, realtime changes to
 * pricing_matrix_versions, and when the tab regains focus.
 */
export function useLabourRateTiers(): LabourRateTiers {
  const [current, setCurrent] = useState<LabourRateOption[]>(() => getLabourRateOptions());
  const [retired, setRetired] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_matrix_versions')
        .select('status, labour_rate_factors, created_at')
        .order('created_at', { ascending: false });
      if (error || !data) {
        setCurrent(getLabourRateOptions());
        return;
      }
      const live = data.find((v: any) => v.status === 'live');
      const liveFactors = (live as any)?.labour_rate_factors as
        | { rate: number; factor: number; label?: string | null }[]
        | null
        | undefined;
      if (Array.isArray(liveFactors) && liveFactors.length) {
        setLiveLabourRateFactors(liveFactors);
      }
      const liveOptions = getLabourRateOptions();
      setCurrent(liveOptions);

      const liveRates = new Set(liveOptions.map((o) => o.rate));
      const historic = new Set<number>();
      data.forEach((v: any) => {
        const factors = v?.labour_rate_factors;
        if (Array.isArray(factors)) {
          factors.forEach((f: any) => {
            const r = Number(f?.rate);
            if (Number.isFinite(r) && !liveRates.has(r)) historic.add(r);
          });
        }
      });
      setRetired(Array.from(historic).sort((a, b) => a - b));
    } catch {
      setCurrent(getLabourRateOptions());
    }
  }, []);

  useEffect(() => {
    refresh();

    const onPricingUpdated = () => setCurrent(getLabourRateOptions());
    window.addEventListener(PRICING_UPDATED_EVENT, onPricingUpdated);

    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    const channel = supabase
      .channel('labour-rate-tiers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pricing_matrix_versions' },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.removeEventListener(PRICING_UPDATED_EVENT, onPricingUpdated);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const format = useCallback(
    (rate: number) => {
      if (current.some((o) => o.rate === rate)) return `£${rate}/hr`;
      if (retired.includes(rate)) return `£${rate}/hr (retired)`;
      return `£${rate}/hr (historic)`;
    },
    [current, retired]
  );

  return { current, retired, format };
}
