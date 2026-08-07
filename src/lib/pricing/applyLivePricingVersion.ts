/**
 * SINGLE ENTRY POINT FOR APPLYING A PRICING VERSION TO LIVE PRICING
 * -------------------------------------------------------------------------
 * Draft isolation is a hard guard, not a convention: this is the only place the
 * live pricing setters are called from, and it refuses any record whose status
 * is not 'live'. Work in the Price Updates tab can therefore be built, tested
 * and previewed on drafts with no possibility of reaching a customer.
 */

import { setLivePricingOverride, setLiveLabourRateFactors, type PricingMatrixShape } from '@/lib/pricingMatrix';
import { setLiveClaimLimitFactors } from '@/lib/claimLimitTiers';
import {
  setLiveVehicleFactorModel,
  setLiveVehicleReferenceVehicle,
  type VehicleFactorModel,
} from '@/lib/pricing/vehicleFactorModel';
import type { ReferenceVehicle } from '@/lib/pricing/pricingVersionConfig';

export type ApplicableVersion = {
  status?: string | null;
  admin_matrix?: unknown;
  step3_discount_pct?: number | null;
  claim_limit_factors?: { limit: number; factor: number }[] | null;
  labour_rate_factors?: { rate: number; factor: number; label?: string | null }[] | null;
  vehicle_factor_model?: VehicleFactorModel | null;
  reference_vehicle?: ReferenceVehicle | null;
};

export type ApplyResult = { applied: boolean; reason?: string };

/**
 * Applies a published version. Returns applied:false (and changes nothing) for
 * drafts, archived versions or an empty grid.
 */
export function applyLivePricingVersion(version?: ApplicableVersion | null): ApplyResult {
  if (!version) return { applied: false, reason: 'no-version' };
  if (version.status !== 'live') {
    return { applied: false, reason: `blocked-status:${version.status ?? 'unknown'}` };
  }
  if (!version.admin_matrix) return { applied: false, reason: 'empty-grid' };

  // Vehicle risk factors first so the very first price read already differs by
  // age / mileage / powertrain instead of pricing every car the same.
  setLiveVehicleFactorModel(version.vehicle_factor_model ?? null);
  setLiveVehicleReferenceVehicle((version.reference_vehicle ?? null) as any);
  setLivePricingOverride(
    version.admin_matrix as PricingMatrixShape,
    Number(version.step3_discount_pct ?? 10)
  );
  setLiveLabourRateFactors(version.labour_rate_factors ?? null);
  setLiveClaimLimitFactors(version.claim_limit_factors ?? null);
  return { applied: true };
}

/** Columns a caller must select for applyLivePricingVersion to work. */
export const LIVE_PRICING_VERSION_COLUMNS =
  'status, admin_matrix, step3_discount_pct, claim_limit_factors, labour_rate_factors, vehicle_factor_model, reference_vehicle, reference_factors, price_floors, price_caps, rounding_rule, effective_date, model_version, config_checksum';
