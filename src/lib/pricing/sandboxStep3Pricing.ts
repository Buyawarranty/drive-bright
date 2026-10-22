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
import {
  payLaterYearlyAmount,
  payLaterTermTotal,
  payLaterExtraVsTerm,
} from '@/lib/bawPayLater';
import type { PaymentPeriod } from '@/lib/pricingMatrix';

export type SandboxTerm = Extract<PaymentPeriod, '12months' | '24months' | '36months'>;

export const SANDBOX_TERMS: SandboxTerm[] = ['12months', '24months', '36months'];

export interface SandboxOptions {
  claimLimit: number;
  voluntaryExcess: number;
  labourRate: number;
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
): SandboxTermPrice {
  const web = calculateWebsiteQuotePrice(vehicle, {
    paymentPeriod: term,
    claimLimit: opts.claimLimit,
    voluntaryExcess: opts.voluntaryExcess,
    labourRate: opts.labourRate,
  });
  const years = yearsFor(term);
  const payLaterEligible = years > 1;
  return {
    term,
    years,
    monthly: web.monthly,
    total: web.total,
    payInFull: web.payInFull,
    payInFullSaving: web.saving,
    payLaterYearly: payLaterEligible ? payLaterYearlyAmount(web.total, years) : null,
    payLaterTermTotal: payLaterEligible ? payLaterTermTotal(web.total, years) : null,
    payLaterExtra: payLaterEligible ? payLaterExtraVsTerm(web.total, years) : null,
  };
}

export function sandboxAllTerms(
  vehicle: WebsiteQuoteVehicle | null | undefined,
  opts: SandboxOptions,
): SandboxTermPrice[] {
  return SANDBOX_TERMS.map(term => sandboxTermPrice(vehicle, term, opts));
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
