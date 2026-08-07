/**
 * PRICING PARITY HARNESS (Phase 0/2 — draft only)
 * ---------------------------------------------------------------------------
 * Runs a fixed vehicle set through the new draft pricing service and through
 * each live surface's assembly, then reports the pound differences.
 *
 * Nothing here changes a price. It only calls the existing exported functions
 * so the comparison reflects exactly what customers and agents see today.
 *
 * Surfaces modelled (see docs/pricing/phase0-audit.md):
 *  - "Quotes & Orders"  -> calculateAdminQuoteWarrantyPrice (admin grid)
 *  - "Step 3/4 cards"   -> calculateTotalWarrantyPrice (customer) minus the
 *                          multi-year goodwill discount that only PricingTable
 *                          applies today (−£100 / −£200)
 *  - "Step 3 inline"    -> calculateTotalWarrantyPrice (customer), i.e. the
 *                          Step3Desktop/Step3Mobile formula with no multi-year
 *                          discount
 */

import {
  calculateAdminQuoteWarrantyPrice,
  calculateTotalWarrantyPrice,
  DEFAULT_CLAIM_LIMIT,
  DEFAULT_EXCESS,
  DEFAULT_LABOUR_RATE,
  type PaymentPeriod,
} from '@/lib/pricingMatrix';
import {
  calculateVehiclePriceAdjustment,
  isMotorbikeAdjustment,
} from '@/lib/vehicleValidation';
import { getVehiclePriceFactor } from '@/lib/pricing/vehicleFactorModel';
import { calculateQuotePrice, type QuoteVehicle } from '@/lib/pricing/quotePricingService';

export const PARITY_MULTI_YEAR_DISCOUNT: Partial<Record<PaymentPeriod, number>> = {
  '24months': 100,
  '36months': 200,
};

export type ParityVehicle = QuoteVehicle & { label: string };

/** Fixed, deliberately spread vehicle set: age, mileage, powertrain, type, brand rules. */
export const PARITY_VEHICLES: ParityVehicle[] = [
  {
    label: 'Vauxhall Zafira 2015 · 85k',
    make: 'Vauxhall',
    model: 'Zafira',
    fuelType: 'Petrol',
    vehicleType: 'Car',
    yearOfManufacture: '2015',
    mileage: '85000',
  },
  {
    label: 'Ford Fiesta 2021 · 18k',
    make: 'Ford',
    model: 'Fiesta',
    fuelType: 'Petrol',
    vehicleType: 'Car',
    yearOfManufacture: '2021',
    mileage: '18000',
  },
  {
    label: 'Toyota Yaris 2018 · 45k (reliable brand)',
    make: 'Toyota',
    model: 'Yaris',
    fuelType: 'Petrol',
    vehicleType: 'Car',
    yearOfManufacture: '2018',
    mileage: '45000',
  },
  {
    label: 'BMW 320d 2013 · 128k (older, high miles)',
    make: 'BMW',
    model: '320d',
    fuelType: 'Diesel',
    vehicleType: 'Car',
    yearOfManufacture: '2013',
    mileage: '128000',
  },
  {
    label: 'Tesla Model 3 2020 · 60k (EV)',
    make: 'Tesla',
    model: 'Model 3',
    fuelType: 'Electric',
    vehicleType: 'Car',
    yearOfManufacture: '2020',
    mileage: '60000',
  },
  {
    label: 'Ford Transit 2017 · 110k (van)',
    make: 'Ford',
    model: 'Transit',
    fuelType: 'Diesel',
    vehicleType: 'Van',
    yearOfManufacture: '2017',
    mileage: '110000',
  },
  {
    label: 'Honda CB500 2019 · 12k (motorbike)',
    make: 'Honda',
    model: 'CB500',
    fuelType: 'Petrol',
    vehicleType: 'Motorbike',
    yearOfManufacture: '2019',
    mileage: '12000',
  },
  {
    label: 'Land Rover Discovery 2016 · 96k',
    make: 'Land Rover',
    model: 'Discovery',
    fuelType: 'Diesel',
    vehicleType: 'Car',
    yearOfManufacture: '2016',
    mileage: '96000',
  },
];

export type ParityOptions = {
  voluntaryExcess?: number;
  claimLimit?: number;
  labourRate?: number;
  boostEnabled?: boolean;
  periods?: PaymentPeriod[];
};

export type ParityRow = {
  vehicle: string;
  period: PaymentPeriod;
  draftAdmin: number;
  liveAdmin: number;
  adminDelta: number;
  draftCustomer: number;
  liveCards: number;
  cardsDelta: number;
  liveInline: number;
  inlineDelta: number;
  legacySurcharge: number;
  doubleCounts: boolean;
  vehicleFactor: number;
};

function liveSurfaceTotals(
  vehicle: QuoteVehicle,
  period: PaymentPeriod,
  opts: Required<Omit<ParityOptions, 'periods'>>
) {
  const years = period === '36months' ? 3 : period === '24months' ? 2 : 1;
  const adjustment = calculateVehiclePriceAdjustment(vehicle as never, years);
  const shared = {
    paymentPeriod: period,
    voluntaryExcess: opts.voluntaryExcess,
    claimLimit: opts.claimLimit,
    labourRate: opts.labourRate,
    boostEnabled: opts.boostEnabled,
    vehicleAdjustment: adjustment.isValid ? adjustment.adjustmentAmount : 0,
    make: vehicle.make ?? null,

    fuelType: vehicle.fuelType ?? null,
    isMotorbike: isMotorbikeAdjustment(adjustment),
    vehicleName: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || null,
    vehicleFactor: getVehiclePriceFactor(vehicle as never),
  };

  const admin = calculateAdminQuoteWarrantyPrice(shared).totalPrice;
  const inline = calculateTotalWarrantyPrice({ ...shared, surface: 'customer' }).totalPrice;
  const cards = Math.max(0, inline - (PARITY_MULTI_YEAR_DISCOUNT[period] ?? 0));
  return { admin, inline, cards };
}

export function buildParityRows(options: ParityOptions = {}): ParityRow[] {
  const opts = {
    voluntaryExcess: options.voluntaryExcess ?? DEFAULT_EXCESS,
    claimLimit: options.claimLimit ?? DEFAULT_CLAIM_LIMIT,
    labourRate: options.labourRate ?? DEFAULT_LABOUR_RATE,
    boostEnabled: options.boostEnabled ?? false,
  };
  const periods = options.periods ?? (['12months', '24months', '36months'] as PaymentPeriod[]);

  const rows: ParityRow[] = [];
  for (const vehicle of PARITY_VEHICLES) {
    for (const period of periods) {
      const live = liveSurfaceTotals(vehicle, period, opts);

      const draftAdminResult = calculateQuotePrice({
        vehicle,
        paymentPeriod: period,
        voluntaryExcess: opts.voluntaryExcess,
        claimLimit: opts.claimLimit,
        labourRate: opts.labourRate,
        boostAddon: opts.boostEnabled,
        surface: 'admin',
        skipEligibility: true,
      });
      const draftCustomerResult = calculateQuotePrice({
        vehicle,
        paymentPeriod: period,
        voluntaryExcess: opts.voluntaryExcess,
        claimLimit: opts.claimLimit,
        labourRate: opts.labourRate,
        boostAddon: opts.boostEnabled,
        surface: 'customer',
        skipEligibility: true,
      });

      rows.push({
        vehicle: vehicle.label,
        period,
        draftAdmin: draftAdminResult.total,
        liveAdmin: live.admin,
        adminDelta: draftAdminResult.total - live.admin,
        draftCustomer: draftCustomerResult.total,
        liveCards: live.cards,
        cardsDelta: draftCustomerResult.total - live.cards,
        liveInline: live.inline,
        inlineDelta: draftCustomerResult.total - live.inline,
        legacySurcharge: draftAdminResult.legacySurcharge,
        doubleCounts: draftAdminResult.legacySurchargeDoubleCounts,
        vehicleFactor: draftAdminResult.vehicleFactor,
      });
    }
  }
  return rows;
}

export type ParitySummary = {
  total: number;
  matchedAdmin: number;
  matchedCards: number;
  matchedInline: number;
  worstAdminDelta: number;
  worstCardsDelta: number;
  worstInlineDelta: number;
};

export function summariseParity(rows: ParityRow[]): ParitySummary {
  const worst = (values: number[]) =>
    values.reduce((acc, v) => (Math.abs(v) > Math.abs(acc) ? v : acc), 0);
  return {
    total: rows.length,
    matchedAdmin: rows.filter((r) => r.adminDelta === 0).length,
    matchedCards: rows.filter((r) => r.cardsDelta === 0).length,
    matchedInline: rows.filter((r) => r.inlineDelta === 0).length,
    worstAdminDelta: worst(rows.map((r) => r.adminDelta)),
    worstCardsDelta: worst(rows.map((r) => r.cardsDelta)),
    worstInlineDelta: worst(rows.map((r) => r.inlineDelta)),
  };
}
