import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setVehiclePricingRules } from '@/lib/pricing/vehicleRules';
import { setLiveClaim5kBlocklist, type Claim5kBlockRule } from '@/lib/claimLimitTiers';
import { refreshLivePricing } from '@/lib/pricing/refreshLivePricing';
import { primeLiveExclusions } from '@/lib/pricing/liveVehicleExclusions';

/**
 * Loads the published (live) pricing version once at app start and applies it as
 * the pricing override. With no live version, pricing stays on the code defaults.
 * Also loads the shared model-specific floors / "not covered" rules so the admin
 * Quotes & Orders page and the customer journey (Steps 3 → 4) use the same list.
 *
 * It also re-reads the live version when the tab regains focus, so a price pushed
 * live elsewhere is reflected in an already-open Quotes & Orders screen.
 */
export default function PricingOverrideLoader() {
  useEffect(() => {
    let cancelled = false;
    void refreshLivePricing();

    void primeLiveExclusions().catch(() => undefined);

    const onFocus = () => {
      if (cancelled) return;
      void refreshLivePricing();
      // Excluded vehicles are independent of pricing versions — re-read them too
      // so an exclusion added elsewhere applies in this already-open tab.
      void primeLiveExclusions().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);



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

    // Manager-set multiples for the 24 / 36 payment plans (agent quotes only).
    (async () => {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('config_value')
          .eq('config_key', LONG_PLAN_MULTIPLES_CONFIG_KEY)
          .maybeSingle();
        if (cancelled || error || !data?.config_value) return;
        const raw = data.config_value as Record<string, unknown>;
        setLongPlanMultiples({ 24: Number(raw['24']), 36: Number(raw['36']) });
      } catch {
        // Ignore — the code defaults (2.22 / 3.51) stay in force.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };

  }, []);

  return null;
}


