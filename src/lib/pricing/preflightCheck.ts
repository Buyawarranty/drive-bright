/**
 * PRE-FLIGHT COMPLETENESS CHECK FOR PUBLISHING A PRICING VERSION
 * -------------------------------------------------------------------------
 * A missing grid cell, labour rate or vehicle factor never crashes the site —
 * it silently falls back to older numbers, so a customer can be quoted a price
 * nobody approved. This runs before a push goes live and lists the gaps.
 *
 * Read-only and fully defensive: it never throws, and it never touches live
 * pricing state. Worst case it reports "could not read" and lets the manager
 * publish anyway.
 */

import { MAX_WEB_DISCOUNT_PCT } from './pricingVersionConfig';
import {
  EXCLUDED_MAKES,
  EXCLUDED_MODEL_RULES,
  getExclusionReason,
} from '@/lib/vehicleExclusions';

export const PREFLIGHT_TERMS = ['12months', '24months', '36months'] as const;
export const PREFLIGHT_EXCESSES = [0, 50, 100, 150, 250, 500] as const;
/** Cover levels the grid must price (retired names 750/1250 are normalised before this runs). */
export const PREFLIGHT_CLAIM_LIMITS = [1000, 2000, 3000] as const;
export const PREFLIGHT_LABOUR_RATES = [50, 70, 100, 150] as const;

export type PreflightSeverity = 'ok' | 'warn' | 'block';

export type PreflightItem = {
  key: string;
  /** What the manager reads, e.g. "Price grid". */
  label: string;
  severity: PreflightSeverity;
  /** One short line, e.g. "All 54 prices filled in". */
  detail: string;
  /** Named gaps, at most a handful shown. */
  gaps?: string[];
};

export type PreflightReport = {
  items: PreflightItem[];
  blocked: boolean;
  hasWarnings: boolean;
};

export type PreflightInput = {
  /** Grid to publish, when the section has one. */
  adminMatrix?: unknown;
  /** Labour rate factors to publish. */
  labourRateFactors?: { rate: number; factor: number | null }[] | null;
  /** Vehicle risk figures to publish (age bands / mileage / powertrain / type). */
  vehicleFactorModel?: any | null;
  /** Step 3/4 gap being published, in percent. */
  webDiscountPct?: number | null;
  /**
   * Any vehicles the version prices explicitly (model floors, per-model risk
   * rules, sample vehicles). Excluded makes/models must never carry a price.
   */
  pricedVehicles?: { make?: string | null; model?: string | null; label?: string | null }[] | null;
};

const MAX_LISTED_GAPS = 6;

/**
 * The excluded vehicle matrix applies to EVERY price we push live. It is code,
 * not version data, so a push can never drop it — this check proves it is
 * loaded and that nothing in the version puts a price on an excluded vehicle.
 */
function checkExclusions(priced: PreflightInput['pricedVehicles']): PreflightItem {
  const ruleCount = EXCLUDED_MAKES.length + EXCLUDED_MODEL_RULES.length;
  if (ruleCount === 0) {
    return {
      key: 'exclusions',
      label: 'Excluded vehicles',
      severity: 'block',
      detail: 'The excluded vehicle matrix is empty — supercars and M/AMG/RS models would be quoted.',
    };
  }
  const offenders = (Array.isArray(priced) ? priced : [])
    .map(v => {
      const reason = getExclusionReason(v?.make, v?.model);
      if (!reason) return null;
      const name = v?.label || [v?.make, v?.model].filter(Boolean).join(' ') || 'Unnamed vehicle';
      return `${name} — excluded (${reason})`;
    })
    .filter(Boolean) as string[];

  if (offenders.length) {
    return {
      key: 'exclusions',
      label: 'Excluded vehicles',
      severity: 'block',
      detail: `${offenders.length} vehicle${offenders.length === 1 ? '' : 's'} in this push are on the excluded list.`,
      gaps: offenders.slice(0, MAX_LISTED_GAPS),
    };
  }
  return {
    key: 'exclusions',
    label: 'Excluded vehicles',
    severity: 'ok',
    detail: `${EXCLUDED_MAKES.length} excluded makes and ${EXCLUDED_MODEL_RULES.length} model rules apply to this price.`,
  };
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function checkGrid(matrix: unknown): PreflightItem {
  const total = PREFLIGHT_TERMS.length * PREFLIGHT_EXCESSES.length * PREFLIGHT_CLAIM_LIMITS.length;
  if (!matrix || typeof matrix !== 'object') {
    return {
      key: 'grid',
      label: 'Price grid',
      severity: 'warn',
      detail: 'No grid in this push — the live grid stays as it is.',
    };
  }
  const gaps: string[] = [];
  const m = matrix as any;
  for (const term of PREFLIGHT_TERMS) {
    for (const excess of PREFLIGHT_EXCESSES) {
      for (const limit of PREFLIGHT_CLAIM_LIMITS) {
        const retired: Record<number, number> = { 1000: 750, 2000: 1250, 3000: 2000 };
        const cells = m?.[term]?.[String(excess)] ?? m?.[term]?.[excess];
        const cell =
          cells?.[String(limit)] ?? cells?.[limit] ?? cells?.[String(retired[limit])];
        if (num(cell) === null) {
          gaps.push(
            `${term.replace('months', ' months')} / £${excess} excess / £${limit.toLocaleString()} limit`
          );
        }
      }
    }
  }
  if (gaps.length) {
    return {
      key: 'grid',
      label: 'Price grid',
      severity: 'block',
      detail: `${gaps.length} of ${total} prices are empty or zero.`,
      gaps: gaps.slice(0, MAX_LISTED_GAPS),
    };
  }
  return {
    key: 'grid',
    label: 'Price grid',
    severity: 'ok',
    detail: `All ${total} prices filled in.`,
  };
}

function checkLabourRates(rates: PreflightInput['labourRateFactors']): PreflightItem {
  if (!Array.isArray(rates) || rates.length === 0) {
    return {
      key: 'labour',
      label: 'Labour rates',
      severity: 'warn',
      detail: 'None in this push — the four rates keep their current factors.',
    };
  }
  const gaps = PREFLIGHT_LABOUR_RATES.filter(rate => {
    const found = rates.find(r => Number(r?.rate) === rate);
    return !found || num(found.factor) === null;
  }).map(rate => `£${rate}/hr has no factor`);
  if (gaps.length) {
    return {
      key: 'labour',
      label: 'Labour rates',
      severity: 'block',
      detail: `${gaps.length} of 4 hourly rates are missing a factor.`,
      gaps,
    };
  }
  return {
    key: 'labour',
    label: 'Labour rates',
    severity: 'ok',
    detail: 'All four rates (£50 / £70 / £100 / £150) have a factor.',
  };
}

/**
 * Bands that sit outside what we are allowed to insure (over 15 years, over
 * 150,000 miles) are deliberately left unpriced — they decline or refer out.
 * Treating those as gaps would block every honest push, so they are skipped.
 */
const isDeclineBand = (b: any): boolean => {
  const key = String(b?.key ?? '').trim().toLowerCase().replace(/\s/g, '');
  if (key === '15+' || key === '150k+' || key === 'over15' || key === 'over150000') return true;
  const text = `${b?.label ?? ''} ${b?.treatment ?? ''} ${b?.customerLabel ?? ''}`.toLowerCase();
  if (text.includes('decline') || text.includes('referral')) return true;

  // Published vehicle-factor models intentionally keep only min/max/factor for
  // mileage bands. Their key and customer label are therefore unavailable when
  // that live model is used as the hybrid starting point. Preserve the known
  // eligibility boundary: mileage above 150,000 is a referral band, not a
  // missing price factor.
  const min = Number(b?.min);
  return Number.isFinite(min) && min >= 150001 && b?.factor == null;
};

function checkVehicleModel(model: any): PreflightItem {
  if (!model || typeof model !== 'object') {
    return {
      key: 'vehicle',
      label: 'Vehicle risk figures',
      severity: 'block',
      detail: 'Missing — without these every car would price the same.',
    };
  }
  const gaps: string[] = [];
  const bands = Array.isArray(model.bands) ? model.bands : [];
  if (!bands.length) gaps.push('No age bands');
  const emptyBands = bands.filter((b: any) => !isDeclineBand(b) && num(b?.oneYear) === null);
  if (emptyBands.length) {
    gaps.push(
      `${emptyBands.length} age band${emptyBands.length === 1 ? '' : 's'} with no one-year price` +
        ` (${emptyBands.slice(0, 3).map((b: any) => b?.key ?? '?').join(', ')})`
    );
  }
  /**
   * A missing reference band is not a gap: the publish step and the quote
   * engine both fall back to the first age band, so pricing stays defined.
   */
  const mileage = Array.isArray(model.mileageBands) ? model.mileageBands : [];
  if (!mileage.length) gaps.push('No mileage bands');
  else if (mileage.some((b: any) => !isDeclineBand(b) && num(b?.factor) === null))
    gaps.push('A mileage band has no factor');

  const powertrains = Array.isArray(model.powertrains) ? model.powertrains : [];
  if (!powertrains.length) gaps.push('No powertrain factors');
  else if (powertrains.some((p: any) => num(p?.factor) === null))
    gaps.push('A powertrain has no factor');
  const types = Array.isArray(model.vehicleTypes) ? model.vehicleTypes : [];
  if (!types.length) gaps.push('No vehicle type factors');
  else if (types.some((t: any) => num(t?.factor) === null)) gaps.push('A vehicle type has no factor');

  if (gaps.length) {
    return {
      key: 'vehicle',
      label: 'Vehicle risk figures',
      severity: 'block',
      detail: 'Incomplete — some vehicles would fall back to older prices.',
      gaps: gaps.slice(0, MAX_LISTED_GAPS),
    };
  }
  return {
    key: 'vehicle',
    label: 'Vehicle risk figures',
    severity: 'ok',
    detail: 'Age, mileage, powertrain and vehicle type all set.',
  };
}

function checkWebGap(pct: number | null | undefined): PreflightItem {
  const value = Number(pct);
  if (!Number.isFinite(value) || value < 0) {
    return {
      key: 'webGap',
      label: 'Step 3/4 gap',
      severity: 'block',
      detail: 'No website gap set — customer prices would be unpredictable.',
    };
  }
  if (value > MAX_WEB_DISCOUNT_PCT) {
    return {
      key: 'webGap',
      label: 'Step 3/4 gap',
      severity: 'block',
      detail: `${value}% is over the ${MAX_WEB_DISCOUNT_PCT}% ceiling.`,
    };
  }
  if (value === 0) {
    return {
      key: 'webGap',
      label: 'Step 3/4 gap',
      severity: 'warn',
      detail: 'Set to 0% — the website will match Quotes & Orders exactly.',
    };
  }
  return {
    key: 'webGap',
    label: 'Step 3/4 gap',
    severity: 'ok',
    detail: `Website prices ${value}% below Quotes & Orders.`,
  };
}

/** Never throws. On an unexpected shape it returns a single warning item. */
export function runPreflightCheck(input: PreflightInput): PreflightReport {
  let items: PreflightItem[];
  try {
    items = [
      checkGrid(input.adminMatrix),
      checkLabourRates(input.labourRateFactors),
      checkVehicleModel(input.vehicleFactorModel),
      checkWebGap(input.webDiscountPct),
      checkExclusions(input.pricedVehicles),
    ];
  } catch {
    items = [
      {
        key: 'error',
        label: 'Completeness check',
        severity: 'warn',
        detail: 'Could not read this version — publish only if you are sure it is complete.',
      },
    ];
  }
  return {
    items,
    blocked: items.some(i => i.severity === 'block'),
    hasWarnings: items.some(i => i.severity === 'warn'),
  };
}
