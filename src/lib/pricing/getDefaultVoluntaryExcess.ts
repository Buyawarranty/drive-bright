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
 * Excess amount a customer lands on for their first visit.
 *
 * Landing default is always £100, so Step 3 opens on the standard combination
 * (2-year cover, £2,000 claim limit, £100 excess, £70/hr labour) and the price
 * shown matches what sales agents see on Quotes & Orders.
 */
export function getDefaultVoluntaryExcess(_vehicleData?: any): number {
  return DEFAULT_EXCESS_BASELINE;
}
