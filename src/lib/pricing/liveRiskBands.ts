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
import {
  bandFixedPriceForTerm,
  clampBandFactor,
  matchRiskBand,
  powertrainFactorFor,
  powertrainMinOneYearFor,
  DEFAULT_RISK_BAND_CONFIG,
  type RiskBandConfig,
} from './vehicleRiskBands';

/** Term scaling for a band 1-year minimum, mirroring the sellable minimums. */
const TERM_FLOOR_RATIO: Record<string, number> = {
  '12months': 1,
  '24months': 769 / 399,
  '36months': 1099 / 399,
};

/**
 * GLOBAL SETTING — the bands are not tied to one pricing version. When no band
 * config has been pushed live (or the live version predates the bands), the
 * shipped defaults still apply, so every price model on Price updates picks up
 * the same band factors and band minimums.
 */
function activeBands(): RiskBandConfig {
  return LIVE_RISK_BANDS ?? DEFAULT_RISK_BAND_CONFIG;
}

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
  const config = activeBands();
  const name = String(vehicleName || '').trim();
  if (!config || !name) return 1;
  const match = matchRiskBand(name, name, config, fuelType ?? undefined);
  const band = match.band;
  if (!band || band.blocked || band.referral) return 1;
  const factor = clampBandFactor(Number(band.factor));
  const bandFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  // Powertrain category (EV / PHEV / HEV) multiplies on top, unless the vehicle
  // has been excluded from its category.
  return bandFactor * powertrainFactorFor(name, name, config, fuelType ?? undefined);
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
  const config = activeBands();
  const name = String(vehicleName || '').trim();
  if (!config || !name) return null;
  const { band } = matchRiskBand(name, name, config, fuelType ?? undefined);
  if (!band || band.blocked || band.referral) return null;
  const bandMin = Number(band.minOneYear);
  const categoryMin = Number(powertrainMinOneYearFor(name, name, config, fuelType ?? undefined) ?? 0);
  const minOneYear = Math.max(Number.isFinite(bandMin) ? bandMin : 0, categoryMin);
  if (!Number.isFinite(minOneYear) || minOneYear <= 0) return null;
  return Math.round(minOneYear * (TERM_FLOOR_RATIO[paymentPeriod] ?? 1));
}

/**
 * PERSONALISED TIER PRICE — exact price published for this vehicle and term
 * (e.g. £1,499 per year). Null when the vehicle is not in a personalised tier.
 */
export function getLiveRiskBandFixedPrice(
  vehicleName: string | null | undefined,
  paymentPeriod: string,
  fuelType?: string | null
): number | null {
  const config = activeBands();
  const name = String(vehicleName || '').trim();
  if (!config || !name) return null;
  const { band } = matchRiskBand(name, name, config, fuelType ?? undefined);
  return bandFixedPriceForTerm(band, paymentPeriod);
}
