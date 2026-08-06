import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setLivePricingOverride, setLiveLabourRateFactors, type PricingMatrixShape } from '@/lib/pricingMatrix';
import { setVehiclePricingRules } from '@/lib/pricing/vehicleRules';
import { setLiveVehicleFactorModel, type VehicleFactorModel } from '@/lib/pricing/vehicleFactorModel';
import { setLiveClaimLimitFactors, setLiveClaim5kBlocklist, type Claim5kBlockRule } from '@/lib/claimLimitTiers';

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
          .select('admin_matrix, step3_discount_pct, claim_limit_factors, labour_rate_factors, vehicle_factor_model')
          .eq('status', 'live')
          .maybeSingle();
        if (cancelled || error || !data?.admin_matrix) return;
        // Vehicle risk factors first so the very first price read already differs
        // by age / mileage / powertrain instead of pricing every car the same.
        setLiveVehicleFactorModel(
          ((data as any).vehicle_factor_model ?? null) as VehicleFactorModel | null
        );
        setLivePricingOverride(
          data.admin_matrix as unknown as PricingMatrixShape,
          Number(data.step3_discount_pct ?? 10)
        );
        setLiveLabourRateFactors(
          (data as any).labour_rate_factors as { rate: number; factor: number; label?: string | null }[] | null
        );
        setLiveClaimLimitFactors(
          (data as any).claim_limit_factors as { limit: number; factor: number }[] | null
        );

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


