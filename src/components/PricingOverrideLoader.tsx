import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setLivePricingOverride, type PricingMatrixShape } from '@/lib/pricingMatrix';

/**
 * Loads the published (live) pricing version once at app start and applies it as
 * the pricing override. With no live version, pricing stays on the code defaults.
 */
export default function PricingOverrideLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_matrix_versions')
          .select('admin_matrix, step3_discount_pct')
          .eq('status', 'live')
          .maybeSingle();
        if (cancelled || error || !data?.admin_matrix) return;
        setLivePricingOverride(
          data.admin_matrix as unknown as PricingMatrixShape,
          Number(data.step3_discount_pct ?? 10)
        );
      } catch {
        // Ignore — fall back to code pricing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
