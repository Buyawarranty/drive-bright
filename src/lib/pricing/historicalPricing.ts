import { supabase } from '@/integrations/supabase/client';
import {
  getLivePricingOverride,
  setLivePricingOverride,
  getLiveLabourRateFactors,
  setLiveLabourRateFactors,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';

export interface PricingVersionSnapshot {
  id: string;
  publishedAt: number; // epoch ms
  matrix: PricingMatrixShape;
  step3DiscountPct: number;
  labourRateFactors: { rate: number; factor: number }[] | null;
}

/**
 * Every price model that has ever been published, newest first.
 *
 * Old sales must always be valued at the prices that were live on the day they
 * were sold — publishing a new price model never re-values historic orders.
 */
export async function loadPricingVersionHistory(): Promise<PricingVersionSnapshot[]> {
  const { data, error } = await supabase
    .from('pricing_matrix_versions')
    .select('id, published_at, admin_matrix, step3_discount_pct, labour_rate_factors')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

  if (error || !data) return [];

  return data
    .filter(v => !!v.admin_matrix)
    .map(v => ({
      id: v.id,
      publishedAt: new Date(v.published_at as string).getTime(),
      matrix: v.admin_matrix as unknown as PricingMatrixShape,
      step3DiscountPct: Number(v.step3_discount_pct ?? 10),
      labourRateFactors: (v.labour_rate_factors as { rate: number; factor: number }[] | null) ?? null,
    }));
}

/** The price model that was live on `date` (falls back to the earliest published one). */
export function pricingVersionAsOf(
  versions: PricingVersionSnapshot[],
  date: Date | string | null | undefined
): PricingVersionSnapshot | null {
  if (!versions.length) return null;
  const t = date ? new Date(date).getTime() : NaN;
  if (!Number.isFinite(t)) return versions[0];
  return versions.find(v => v.publishedAt <= t) ?? versions[versions.length - 1];
}

/**
 * Runs `fn` with the pricing engine temporarily pinned to the model that was
 * live on `date`, then always restores the current live model.
 */
export function withPricingAsOf<T>(
  versions: PricingVersionSnapshot[],
  date: Date | string | null | undefined,
  fn: () => T
): T {
  const version = pricingVersionAsOf(versions, date);
  if (!version) return fn();
  const previous = getLivePricingOverride();
  const previousLabour = getLiveLabourRateFactors();
  try {
    setLivePricingOverride(version.matrix, version.step3DiscountPct);
    setLiveLabourRateFactors(version.labourRateFactors);
    return fn();
  } finally {
    setLivePricingOverride(previous.adminMatrix, previous.step3DiscountPct);
    setLiveLabourRateFactors(previousLabour);
  }
}

