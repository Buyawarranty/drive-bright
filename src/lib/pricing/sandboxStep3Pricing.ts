/**
 * STEP 3 SANDBOX PRICING
 * ---------------------------------------------------------------------------
 * Pure helpers for the super-admin Step 3 sandbox. Every figure comes from the
 * SHARED pricing engine (`calculateWebsiteQuotePrice` mirrors the real Step 3
 * exactly, and `bawPayLater` holds the locked PayLater rules) so the sandbox
 * can never drift from what customers would actually be charged.
 *
 * Nothing here writes anywhere — it only computes display figures.
 */

import {
  calculateWebsiteQuotePrice,
  type WebsiteQuoteVehicle,
} from '@/lib/pricing/websiteQuotePrice';
import { payLaterYearlyAmount } from '@/lib/bawPayLater';
import type { PaymentPeriod } from '@/lib/pricingMatrix';

export type SandboxTerm = Extract<PaymentPeriod, '12months' | '24months' | '36months'>;

export const SANDBOX_TERMS: SandboxTerm[] = ['12months', '24months', '36months'];

export interface SandboxOptions {
  claimLimit: number;
  voluntaryExcess: number;
  labourRate: number;
}

/**
 * Sandbox-only price tweaks. Never persisted, never pushed live — they only
 * change what the sandbox preview shows so management can experiment.
 */
export interface SandboxTweaks {
  /** Percentage adjustment applied to every term price (e.g. 5 = +5%, -10 = −10%). */
  priceAdjustPct: number;
  /** BAW PayLater yearly-collection uplift in percent (live rule: 10). */
  payLaterUpliftPct: number;
}

export const DEFAULT_SANDBOX_TWEAKS: SandboxTweaks = {
  priceAdjustPct: 0,
  payLaterUpliftPct: 10,
};

/** True when the tweaks match the live rules exactly (nothing being tested). */
export function tweaksAreLive(tweaks: SandboxTweaks | null | undefined): boolean {
  if (!tweaks) return true;
  return (Number(tweaks.priceAdjustPct) || 0) === 0 &&
    (Number(tweaks.payLaterUpliftPct) ?? 10) === 10;
}

export interface SandboxTermPrice {
  term: SandboxTerm;
  years: number;
  /** Lead figure: the 12-instalment monthly payment. */
  monthly: number;
  /** Total of the 12 instalments. */
  total: number;
  /** One-off amount today with the pay-in-full saving. */
  payInFull: number;
  /** What paying in full saves versus the 12 instalments. */
  payInFullSaving: number;
  /** BAW PayLater per-year collection (null for 1-year cover). */
  payLaterYearly: number | null;
  /** Everything the customer pays across the term on PayLater. */
  payLaterTermTotal: number | null;
  /** Extra cost of PayLater versus the 12-instalment total. */
  payLaterExtra: number | null;
}

const yearsFor = (term: SandboxTerm): number =>
  term === '36months' ? 3 : term === '24months' ? 2 : 1;

export function sandboxTermPrice(
  vehicle: WebsiteQuoteVehicle | null | undefined,
  term: SandboxTerm,
  opts: SandboxOptions,
  tweaks?: SandboxTweaks,
): SandboxTermPrice {
  const web = calculateWebsiteQuotePrice(vehicle, {
    paymentPeriod: term,
    claimLimit: opts.claimLimit,
    voluntaryExcess: opts.voluntaryExcess,
    labourRate: opts.labourRate,
  });
  const years = yearsFor(term);
  const payLaterEligible = years > 1;

  // Sandbox tweaks: adjust the monthly figure, then rebuild every derived
  // amount (12-payment total, pay-in-full, PayLater) from it so all figures
  // stay internally consistent. Floors are NOT re-applied — this is an
  // experiment, not a sellable price.
  const adjustPct = Math.min(Math.max(Number(tweaks?.priceAdjustPct) || 0, -50), 50);
  const monthly = adjustPct === 0
    ? web.monthly
    : Math.max(1, Math.ceil(web.monthly * (1 + adjustPct / 100)));
  const total = monthly * 12;
  const payInFullSaving = Math.floor((total * 10) / 100);
  const payInFull = total - payInFullSaving;

  const upliftPct = tweaks?.payLaterUpliftPct == null
    ? 10
    : Math.min(Math.max(Number(tweaks.payLaterUpliftPct) || 0, 0), 50);
  const yearly = payLaterEligible
    ? (upliftPct === 10
        ? payLaterYearlyAmount(total, years)
        : Math.round((total / years) * (1 + upliftPct / 100)))
    : null;

  return {
    term,
    years,
    monthly,
    total,
    payInFull,
    payInFullSaving,
    payLaterYearly: yearly,
    payLaterTermTotal: yearly != null ? yearly * years : null,
    payLaterExtra: yearly != null ? Math.max(0, yearly * years - total) : null,
  };
}

export function sandboxAllTerms(
  vehicle: WebsiteQuoteVehicle | null | undefined,
  opts: SandboxOptions,
  tweaks?: SandboxTweaks,
): SandboxTermPrice[] {
  return SANDBOX_TERMS.map(term => sandboxTermPrice(vehicle, term, opts, tweaks));
}

/**
 * The Quotes & Orders price for a website total. Q&O is the grid; the website
 * is the grid minus the gap (10% today), so grid = web ÷ (1 − gap). Whole
 * pounds, rounded up — a Q&O quote may never come out below the web price.
 */
export function quotesOrdersTotal(webTotal: number, gapPct: number): number {
  const web = Number(webTotal) || 0;
  const gap = Math.min(Math.max(Number(gapPct) || 0, 0), 50) / 100;
  if (web <= 0) return 0;
  if (gap <= 0) return Math.ceil(web);
  return Math.ceil(web / (1 - gap));
}
