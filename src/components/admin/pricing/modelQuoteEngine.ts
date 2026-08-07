import { mapVehicleToBandKeys, type ResolvedTestVehicle } from './RegLookupBar';

/**
 * SHARED PRICE ENGINE for the age-band pricing model.
 *
 * This is the exact same maths the "Aug hybrid test — Step 2" sandbox uses
 * (PriceTestStep2), lifted out so Quotes & Orders can quote from the published
 * model too. Both screens must always produce the same number for the same
 * vehicle + options, otherwise agents quote something the test model never showed.
 */

/** Never sell below £399 for one year; 2/3 year floors follow the term multipliers. */
export const MIN_SELLABLE_BY_MONTHS: Record<number, number> = {
  12: 399,
  24: 659,
  36: 938,
};

export interface ModelQuoteVehicle {
  ageYears?: number | null;
  mileage?: number | null;
  fuelType?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
}

export interface ModelQuoteOptions {
  /** '12months' | '24months' | '36months' */
  paymentPeriod: string;
  voluntaryExcess: number;
  /** Customer-facing claim limit tier (1000 / 2000 / 3000 / 5000). */
  claimLimit: number;
  labourRate: number;
  /** £19 warranty-transfer cover, as on the sandbox. */
  transferCover?: boolean;
}

export interface ModelQuoteResult {
  /** True when this profile must be referred instead of auto-quoted. */
  referral: boolean;
  /** One-year-equivalent price with all option factors applied. */
  annual: number;
  totalPrice: number;
  monthlyPrice: number;
  payInFullPrice: number;
  minSellable: number;
  belowMinimum: boolean;
}

const MONTHS_BY_PERIOD: Record<string, number> = {
  '12months': 12,
  '24months': 24,
  '36months': 36,
};

function nearestFactor<T extends { factor?: number | null }>(
  list: T[],
  match: (item: T) => boolean,
  distance: (item: T) => number
): number {
  const exact = list.find(match);
  if (exact) return Number(exact.factor ?? 1);
  const sorted = [...list].sort((a, b) => distance(a) - distance(b));
  return Number(sorted[0]?.factor ?? 1);
}

/**
 * Price a quote straight from the saved/published pricing model.
 * Returns null when the model has no usable bands (caller falls back to the grid).
 */
export function priceFromPricingModel(
  model: {
    ageBands: any[];
    mileageBands: any[];
    powertrains: any[];
    vehicleTypes: any[];
    modelRisks: any[];
    modelFloors: any[];
    claimLimits: any[];
    labourRateFactors: any[];
    excessFactors: any[];
    twoYearMult: number;
    threeYearMult: number;
    payInFullFactor: number;
  },
  vehicle: ModelQuoteVehicle,
  options: ModelQuoteOptions
): ModelQuoteResult | null {
  if (!model?.ageBands?.length) return null;

  const keys = mapVehicleToBandKeys(
    {
      reg: '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      ageYears: vehicle.ageYears ?? null,
      mileage: vehicle.mileage ?? null,
      fuelType: vehicle.fuelType ?? '',
      vehicleType: vehicle.vehicleType ?? '',
    } as unknown as ResolvedTestVehicle,
    {
      ageBands: model.ageBands,
      mileageBands: model.mileageBands,
      powertrains: model.powertrains,
      vehicleTypes: model.vehicleTypes,
      modelFloors: model.modelFloors,
    }
  );

  const ageBand = model.ageBands.find(b => b.key === keys.ageKey) ?? model.ageBands[0];
  const mileageBand =
    model.mileageBands.find(b => b.key === keys.mileageKey) ?? model.mileageBands[0];
  const powertrain =
    model.powertrains.find(p => p.key === keys.powertrainKey) ?? model.powertrains[0];
  const vehType = model.vehicleTypes.find(t => t.key === keys.typeKey) ?? model.vehicleTypes[0];
  // Quotes & Orders has no manual "model risk" selector — always the normal band.
  const risk = model.modelRisks.find(r => r.key === 'normal') ?? model.modelRisks[0];
  const floor = model.modelFloors.find(f => f.key === keys.floorKey) || null;

  const referral =
    ageBand?.oneYear == null ||
    mileageBand?.factor == null ||
    vehType?.factor == null ||
    risk?.factor == null ||
    (floor ? floor.covered === false : false);

  const months = MONTHS_BY_PERIOD[options.paymentPeriod] ?? 12;
  const termMult = months === 24 ? Number(model.twoYearMult) : months === 36 ? Number(model.threeYearMult) : 1;

  if (referral) {
    return {
      referral: true,
      annual: 0,
      totalPrice: 0,
      monthlyPrice: 0,
      payInFullPrice: 0,
      minSellable: MIN_SELLABLE_BY_MONTHS[months] ?? 399,
      belowMinimum: false,
    };
  }

  const isMotorbike = vehType.key === 'motorbike';
  /** Motorbikes price at 50% of a standard vehicle — the floors halve with the price. */
  const motorbikeFactor = isMotorbike ? 0.5 : 1;

  const claimFactor = nearestFactor(
    model.claimLimits,
    c => Number(c.limit) === Number(options.claimLimit),
    c => Math.abs(Number(c.limit) - Number(options.claimLimit))
  );
  const labourFactor = nearestFactor(
    model.labourRateFactors,
    l => Number(l.rate) === Number(options.labourRate),
    l => Math.abs(Number(l.rate) - Number(options.labourRate))
  );
  const excessFactor = nearestFactor(
    model.excessFactors,
    e => Number(e.excess) === Number(options.voluntaryExcess),
    e => Math.abs(Number(e.excess) - Number(options.voluntaryExcess))
  );

  const annualBase =
    Number(ageBand.oneYear) *
    Number(mileageBand.factor) *
    Number(powertrain?.factor ?? 1) *
    Number(vehType.factor) *
    Number(risk.factor);
  const modelFloor = floor?.minOneYear ? Number(floor.minOneYear) * motorbikeFactor : null;
  const floored = modelFloor ? Math.max(annualBase, modelFloor) : annualBase;
  const annual = floored * claimFactor * labourFactor * excessFactor;

  let total = annual * termMult;
  if (options.transferCover) total += 19;
  total = Math.round(total);

  const minSellable = Math.round((MIN_SELLABLE_BY_MONTHS[months] ?? 399) * motorbikeFactor);
  const belowMinimum = total < minSellable;
  if (belowMinimum) total = minSellable;

  // We only ever offer 12 monthly instalments, whatever the cover term.
  const monthlyPrice = Math.ceil(total / 12);
  const payInFullPrice = Math.round(total * Number(model.payInFullFactor ?? 0.9));

  return {
    referral: false,
    annual,
    totalPrice: total,
    monthlyPrice,
    payInFullPrice,
    minSellable,
    belowMinimum,
  };
}
