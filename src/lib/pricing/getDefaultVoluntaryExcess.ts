import { getVehiclePriceFactor } from '@/lib/pricing/vehicleFactorModel';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment, isMotorbikeAdjustment } from '@/lib/vehicleValidation';
import { getBaseClaimLimit } from '@/lib/claimLimitTiers';
import {
  getBasePrice as getCentralizedBasePrice,
  applyBasePriceFloor,
  applyReliableBrandDiscount,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';

/** Default duration, labour rate and claim limit the Step 3 landing state uses. */
const DEFAULT_PAYMENT_PERIOD: PaymentPeriod = '24months';
const DEFAULT_LABOUR_RATE = 70;
const DEFAULT_CLAIM_LIMIT = 2000;
const DEFAULT_EXCESS_BASELINE = 100;

/**
 * Decide the excess amount a customer should land on for their first visit.
 *
 * Rule: compute the warranty at the default settings (2-year, £70/hr, £2,000
 * claim limit, £100 baseline excess) and the specific vehicle. If that baseline
 * warranty price is £500 or more, default to £150. Otherwise default to £100.
 *
 * Auto-included add-ons are free at default, so they do not affect the
 * threshold calculation.
 */
export function getDefaultVoluntaryExcess(vehicleData?: any): number {
  if (!vehicleData) return DEFAULT_EXCESS_BASELINE;

  const warrantyYears = DEFAULT_PAYMENT_PERIOD === '12months' ? 1 : DEFAULT_PAYMENT_PERIOD === '24months' ? 2 : 3;
  const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicleData, warrantyYears);

  const rawBase = getCentralizedBasePrice(
    DEFAULT_PAYMENT_PERIOD,
    DEFAULT_EXCESS_BASELINE,
    getBaseClaimLimit(DEFAULT_CLAIM_LIMIT),
    'customer',
    getVehiclePriceFactor(vehicleData)
  );

  const basePrice = applyReliableBrandDiscount(rawBase, vehicleData?.make, vehicleData?.fuelType);
  const adjustedPrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
  const flooredBase = applyBasePriceFloor(
    adjustedPrice,
    DEFAULT_PAYMENT_PERIOD,
    DEFAULT_EXCESS_BASELINE,
    isMotorbikeAdjustment(vehicleAdjustment),
    'customer',
    [vehicleData?.make, vehicleData?.model].filter(Boolean).join(' ') || null,
    DEFAULT_CLAIM_LIMIT
  );

  return flooredBase >= 500 ? 150 : 100;
}
