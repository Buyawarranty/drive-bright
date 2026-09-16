/**
 * WEBSITE PRICE FOR ONE COVER COMBINATION
 * ---------------------------------------------------------------------------
 * The chatbot used to price with its own simplified formula in the edge
 * function, which ignored the vehicle risk factor, brand discount, excess
 * bracket and sell floor — so Miles quoted a different price from the one the
 * customer saw on step 3 (and fell back to the default £2,000 claim limit).
 *
 * This helper mirrors Step3Desktop.computeDurationMonthly / PricingTable EXACTLY
 * so any surface that needs "what would the website charge for this
 * combination?" gets the same number. If step 3's formula changes, change it
 * here in the same commit.
 */

import {
  getBasePrice,
  applyReliableBrandDiscount,
  applyBasePriceFloor,
  calculateLabourRateAdjustment,
  getExcessTotalAdjustment,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import { getBaseClaimLimit, getClaimLimitSurcharge } from '@/lib/claimLimitTiers';
import { getVehiclePriceFactor } from '@/lib/pricing/vehicleFactorModel';
import {
  calculateVehiclePriceAdjustment,
  applyPriceAdjustment,
  isMotorbikeAdjustment,
} from '@/lib/vehicleValidation';
import { applyWebsiteSellFloor } from '@/lib/pricing/netFloor';
import { payInFullSaving, payInFullTotal, twelvePaymentTotal } from '@/lib/pricing/payInFull';

export type WebsiteQuoteVehicle = {
  make?: string | null;
  model?: string | null;
  fuelType?: string | null;
  vehicleType?: string | null;
  year?: string | number | null;
  yearOfManufacture?: string | number | null;
  registrationDate?: string | null;
  mileage?: string | number | null;
  regNumber?: string | null;
};

export type WebsiteQuoteOptions = {
  paymentPeriod: PaymentPeriod;
  claimLimit: number;
  voluntaryExcess: number;
  labourRate: number;
};

export type WebsiteQuotePrice = {
  /** Monthly instalment — always 12 instalments, whatever the cover length. */
  monthly: number;
  /** Total of the 12 instalments. */
  total: number;
  /** One-off amount payable today (10% pay-in-full discount). */
  payInFull: number;
  /** What paying in full saves. */
  saving: number;
};

const monthsFor = (period: PaymentPeriod): number =>
  period === '36months' ? 36 : period === '24months' ? 24 : 12;

export function calculateWebsiteQuotePrice(
  vehicle: WebsiteQuoteVehicle | null | undefined,
  { paymentPeriod, claimLimit, voluntaryExcess, labourRate }: WebsiteQuoteOptions,
): WebsiteQuotePrice {
  const months = monthsFor(paymentPeriod);
  const warrantyYears = months / 12;
  const v = (vehicle ?? {}) as any;

  const vehicleAdjustment = calculateVehiclePriceAdjustment(v, warrantyYears);
  const isMotorbike = isMotorbikeAdjustment(vehicleAdjustment);
  const vehicleName = [v?.make, v?.model].filter(Boolean).join(' ');

  // Base grid cell, with the vehicle risk factor and reliable-brand discount.
  const rawBase = getBasePrice(
    paymentPeriod,
    voluntaryExcess,
    getBaseClaimLimit(claimLimit),
    'customer',
    getVehiclePriceFactor(v),
  );
  const basePrice = applyReliableBrandDiscount(rawBase, v?.make, v?.fuelType);

  const adjustedBasePrice = applyBasePriceFloor(
    applyPriceAdjustment(basePrice, vehicleAdjustment),
    paymentPeriod,
    voluntaryExcess,
    isMotorbike,
    'customer',
    vehicleName,
    claimLimit,
  );

  const labourAdjust = calculateLabourRateAdjustment(labourRate, paymentPeriod, adjustedBasePrice);
  const premiumSurcharge = getClaimLimitSurcharge(claimLimit, paymentPeriod, voluntaryExcess);
  const excessAdjust = getExcessTotalAdjustment(paymentPeriod, voluntaryExcess, adjustedBasePrice);

  const floored = applyWebsiteSellFloor(
    adjustedBasePrice + labourAdjust + premiumSurcharge + excessAdjust,
    { paymentPeriod, voluntaryExcess, claimLimit, labourRate, isMotorbike },
  );

  const monthly = Math.ceil(floored / 12);
  return {
    monthly,
    total: twelvePaymentTotal(monthly),
    payInFull: payInFullTotal(monthly),
    saving: payInFullSaving(monthly),
  };
}
