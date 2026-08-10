/**
 * SOLD PRICE vs SYSTEM REFERENCE PRICE
 * ---------------------------------------------------------------------------
 * Some sales are agreed outside the system (bank transfer, card over the phone)
 * and only *confirmed* afterwards, so the amount collected can quietly sit below
 * what the pricing engine would have quoted for that exact combination.
 *
 * Given the cover options stored on the order (reg / vehicle, claim limit,
 * voluntary excess, labour rate, duration) this recomputes:
 *   - QOP — the Quotes & Orders (admin grid) price
 *   - RP  — the retail / website price shown on Step 3
 * and compares them with the amount actually collected.
 *
 * Thresholds mirror the live guards: a hard 30% discount ceiling versus QOP and
 * the absolute net payable floor. Anything past those is a breach and must be
 * flagged (and blocked at the point of confirmation).
 */
import { calculateQuotePrice } from '@/lib/pricing/quotePricingService';
import { getNetPayableFloor } from '@/lib/pricing/netFloor';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import {
  DEFAULT_CLAIM_LIMIT,
  DEFAULT_EXCESS,
  DEFAULT_LABOUR_RATE,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';

export const DISCOUNT_CEILING_PCT = 30;

export interface SoldOrderLike {
  registration_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_fuel_type?: string | null;
  vehicle_transmission?: string | null;
  vehicle_year?: string | number | null;
  vehicle_type?: string | null;
  mileage?: string | number | null;
  payment_type?: string | null;
  voluntary_excess?: number | null;
  claim_limit?: number | null;
  labour_rate?: number | null;
  final_amount?: number | null;
}

export interface SoldVsReference {
  /** Quotes & Orders (admin grid) price for these options. */
  qop: number;
  /** Retail price as shown on the website Step 3. */
  rp: number;
  /** Amount actually collected. */
  sold: number;
  /** Sold vs QOP, negative when sold under the grid price. */
  diffVsQop: number;
  diffVsQopPct: number;
  /** Sold vs retail price. */
  diffVsRp: number;
  diffVsRpPct: number;
  /** Lowest amount this combination may ever be sold for. */
  netFloor: number;
  /** Lowest allowed amount = whichever bites harder (30% ceiling vs net floor). */
  minAllowed: number;
  /** Sold more than 30% below QOP. */
  overCeiling: boolean;
  /** Sold below the absolute net payable floor. */
  underFloor: boolean;
  /** Either breach — needs management authorisation. */
  breach: boolean;
  period: PaymentPeriod;
}

const toPeriod = (paymentType?: string | null): PaymentPeriod => {
  const months = getWarrantyDurationInMonths(String(paymentType || '12months'));
  if (months >= 36) return '36months';
  if (months >= 24) return '24months';
  return '12months';
};

const isMotorbike = (order: SoldOrderLike): boolean =>
  /motor\s*(bike|cycle)|\bbike\b/i.test(String(order.vehicle_type || ''));

/**
 * Recompute the reference prices for an order and compare with what was taken.
 * Returns null when there is not enough data (no sold amount, no vehicle).
 */
export const getSoldVsReference = (order?: SoldOrderLike | null): SoldVsReference | null => {
  if (!order) return null;

  const sold = Number(order.final_amount) || 0;
  if (sold <= 0) return null;

  const period = toPeriod(order.payment_type);
  const voluntaryExcess = Number(order.voluntary_excess ?? DEFAULT_EXCESS) || 0;
  const claimLimit = Number(order.claim_limit) || DEFAULT_CLAIM_LIMIT;
  const labourRate = Number(order.labour_rate) || DEFAULT_LABOUR_RATE;

  let qop = 0;
  let rp = 0;
  try {
    const admin = calculateQuotePrice({
      vehicle: {
        make: order.vehicle_make ?? null,
        model: order.vehicle_model ?? null,
        fuelType: order.vehicle_fuel_type ?? null,
        transmission: order.vehicle_transmission ?? null,
        vehicleType: order.vehicle_type ?? null,
        yearOfManufacture: order.vehicle_year ?? null,
        mileage: order.mileage ?? null,
        regNumber: order.registration_plate ?? null,
      },
      paymentPeriod: period,
      voluntaryExcess,
      claimLimit,
      labourRate,
      surface: 'admin',
      skipEligibility: true,
    });
    qop = Math.round(admin.total);
    rp = Math.round(admin.webReferencePrice || admin.total);
  } catch {
    return null;
  }

  if (qop <= 0) return null;

  const netFloor = getNetPayableFloor({
    paymentPeriod: period,
    voluntaryExcess,
    claimLimit,
    labourRate,
    isMotorbike: isMotorbike(order),
    surface: 'admin',
  });
  const ceilingMinAmount = Math.round(qop * (1 - DISCOUNT_CEILING_PCT / 100));
  const minAllowed = Math.max(ceilingMinAmount, netFloor);

  const diffVsQop = Math.round(sold - qop);
  const diffVsRp = Math.round(sold - rp);
  const overCeiling = sold < ceilingMinAmount - 0.5;
  const underFloor = sold < netFloor - 0.5;

  return {
    qop,
    rp,
    sold: Math.round(sold * 100) / 100,
    diffVsQop,
    diffVsQopPct: Math.round((diffVsQop / qop) * 1000) / 10,
    diffVsRp,
    diffVsRpPct: rp > 0 ? Math.round((diffVsRp / rp) * 1000) / 10 : 0,
    netFloor,
    minAllowed,
    overCeiling,
    underFloor,
    breach: overCeiling || underFloor,
    period,
  };
};

/** Badge colour for the sold-vs-reference gap. */
export const referenceGapClass = (r: SoldVsReference): string => {
  if (r.breach) return 'border-red-400 text-red-700 bg-red-50';
  if (r.diffVsQopPct <= -20) return 'border-orange-300 text-orange-700 bg-orange-50';
  if (r.diffVsQopPct < 0) return 'border-amber-300 text-amber-700 bg-amber-50';
  return 'border-green-300 text-green-700 bg-green-50';
};
