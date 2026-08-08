import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setVehiclePricingRules } from '@/lib/pricing/vehicleRules';
import { setLiveClaim5kBlocklist, type Claim5kBlockRule } from '@/lib/claimLimitTiers';
import {
  applyLivePricingVersion,
  LIVE_PRICING_VERSION_COLUMNS,
} from '@/lib/pricing/applyLivePricingVersion';

/**
 * Loads the published (live) pricing version once at app start and applies it as
 * the pricing override. With no live version, pricing stays on the code defaults.
 * Also loads the shared model-specific floors / "not covered" rules so the admin
 * Quotes & Orders page and the customer journey (Steps 3 → 4) use the same list.
 */
export default function PricingOverrideLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_matrix_versions')
          .select(LIVE_PRICING_VERSION_COLUMNS)
          .eq('status', 'live')
          .maybeSingle();
        if (cancelled || error || !data) return;
        // Guarded: only a version with status 'live' can ever be applied.
        applyLivePricingVersion(data as any);
        // Let screens that quote from the published model (Quotes & Orders) re-read it.
        window.dispatchEvent(new Event('bw:pricing-updated'));
      } catch {
        // Ignore — fall back to code pricing.
      }
    })();


    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_vehicle_rules')
          .select('id, vehicle, min_one_year, treatment, covered')
          .order('sort_order', { ascending: true });
        if (cancelled || error || !data) return;
        setVehiclePricingRules(
          data.map(r => ({
            key: r.id,
            vehicle: r.vehicle,
            minOneYear: r.min_one_year === null ? null : Number(r.min_one_year),
            treatment: r.treatment,
            covered: r.covered !== false,
          }))
        );
      } catch {
        // Ignore — no model-specific rules applied.
      }
    })();

    (async () => {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('config_value')
          .eq('config_key', 'claim_limit_5000_blocklist')
          .maybeSingle();
        if (cancelled || error || !Array.isArray(data?.config_value)) return;
        setLiveClaim5kBlocklist(data.config_value as unknown as Claim5kBlockRule[]);
      } catch {
        // Ignore — fall back to the code default blocked makes.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}


