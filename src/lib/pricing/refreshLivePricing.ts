/**
 * RE-READS THE PUBLISHED (LIVE) PRICING VERSION AND APPLIES IT
 * -------------------------------------------------------------------------
 * Called at app start and again immediately after any "Push live" in the Price
 * Updates tab, so open screens that quote from the live model — above all
 * Quotes & Orders (Get a quote / import lead) — pick up new prices without a
 * page reload. Draft isolation still holds: applyLivePricingVersion refuses any
 * row whose status is not 'live'.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  applyLivePricingVersion,
  LIVE_PRICING_VERSION_COLUMNS,
} from '@/lib/pricing/applyLivePricingVersion';
import { PRICING_UPDATED_EVENT } from '@/lib/pricingMatrix';

export async function refreshLivePricing(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('pricing_matrix_versions')
      .select(LIVE_PRICING_VERSION_COLUMNS)
      .eq('status', 'live')
      .maybeSingle();
    if (error || !data) return false;
    const result = applyLivePricingVersion(data as any);
    // Always notify: listeners re-read the live model and re-render their prices.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PRICING_UPDATED_EVENT));
    }
    return result.applied;
  } catch {
    return false;
  }
}
