/**
 * PUBLISHED (PUSHED-LIVE) VEHICLE TYPE & MODEL-RISK BANDS
 * -------------------------------------------------------------------------
 * The risk band panel is a draft tool: bands and make/model assignments live in
 * the manager's browser until they are pushed live. Pushing live writes the whole
 * band config onto WHICHEVER pricing version is currently live (inside its
 * `vehicle_factor_model` payload), so the bands travel with that version and are
 * re-applied on every page load by applyLivePricingVersion.
 *
 * Live effect of a published band, on both surfaces (Quotes & Orders and Steps 3/4):
 *   - band factor multiplies the base price
 *   - band minimum 1-year price lifts the price floor (halved for motorbikes)
 *   - referral / not-covered bands never change a price here; blocking stays with
 *     the excluded vehicle matrix so there is exactly one decline path.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  clampBandFactor,
  matchRiskBand,
  type RiskBandConfig,
} from './vehicleRiskBands';

/** Term scaling for a band 1-year minimum, mirroring the sellable minimums. */
const TERM_FLOOR_RATIO: Record<string, number> = {
  '12months': 1,
  '24months': 659 / 399,
  '36months': 938 / 399,
};

let LIVE_RISK_BANDS: RiskBandConfig | null = null;

export function setLiveRiskBandConfig(config: RiskBandConfig | null): void {
  LIVE_RISK_BANDS =
    config && Array.isArray(config.bands) && config.bands.length ? config : null;
}

export function getLiveRiskBandConfig(): RiskBandConfig | null {
  return LIVE_RISK_BANDS;
}

/**
 * Price multiplier for this vehicle from the published bands.
 * Returns 1 when nothing is published, nothing matches, or the band is a
 * referral / not-covered band (those are handled outside pricing).
 */
export function getLiveRiskBandFactor(
  vehicleName?: string | null,
  fuelType?: string | null
): number {
  const config = LIVE_RISK_BANDS;
  const name = String(vehicleName || '').trim();
  if (!config || !name) return 1;
  const match = matchRiskBand(name, name, config, fuelType ?? undefined);
  const band = match.band;
  if (!band || band.blocked || band.referral) return 1;
  const factor = clampBandFactor(Number(band.factor));
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/**
 * Minimum price this vehicle may be quoted at for the term, from the published
 * bands. Null when no published band sets a minimum.
 */
export function getLiveRiskBandMinPrice(
  vehicleName: string | null | undefined,
  paymentPeriod: string,
  fuelType?: string | null
): number | null {
  const config = LIVE_RISK_BANDS;
  const name = String(vehicleName || '').trim();
  if (!config || !name) return null;
  const { band } = matchRiskBand(name, name, config, fuelType ?? undefined);
  if (!band || band.blocked || band.referral) return null;
  const minOneYear = Number(band.minOneYear);
  if (!Number.isFinite(minOneYear) || minOneYear <= 0) return null;
  return Math.round(minOneYear * (TERM_FLOOR_RATIO[paymentPeriod] ?? 1));
}

export interface PublishRiskBandsResult {
  published: boolean;
  /** Label of the live pricing version the bands were attached to. */
  versionLabel?: string;
  reason?: string;
}

/**
 * Attach the band config to whatever pricing version is live right now and apply
 * it in this tab immediately. Nothing else about the live version is touched.
 */
export async function publishRiskBandsToLiveVersion(
  config: RiskBandConfig
): Promise<PublishRiskBandsResult> {
  const { data, error } = await supabase
    .from('pricing_matrix_versions')
    .select('id, label, vehicle_factor_model')
    .eq('status', 'live')
    .order('published_at', { ascending: false })
    .limit(1);

  if (error) return { published: false, reason: error.message };
  const live = data?.[0];
  if (!live) {
    return {
      published: false,
      reason: 'No pricing version is live yet — publish a pricing version first.',
    };
  }

  const existing = (live.vehicle_factor_model as Record<string, unknown> | null) ?? {};
  const nextModel = { ...existing, riskBands: config };

  const { error: updateError } = await supabase
    .from('pricing_matrix_versions')
    .update({ vehicle_factor_model: nextModel as never })
    .eq('id', live.id);

  if (updateError) return { published: false, reason: updateError.message };

  setLiveRiskBandConfig(config);
  return { published: true, versionLabel: live.label };
}

/** Label of the pricing version currently live, for the push-live bar. */
export async function fetchLivePricingVersionLabel(): Promise<string | null> {
  const { data } = await supabase
    .from('pricing_matrix_versions')
    .select('label, published_at')
    .eq('status', 'live')
    .order('published_at', { ascending: false })
    .limit(1);
  return data?.[0]?.label ?? null;
}
