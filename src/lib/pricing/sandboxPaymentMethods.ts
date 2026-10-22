/**
 * STEP 3 SANDBOX — PAYMENT METHODS
 * ---------------------------------------------------------------------------
 * A pluggable registry of ways-to-pay for the super-admin step 3 sandbox.
 * Each method is a pure function from a term price to a display quote, so new
 * providers (Klarna, Zopa, …) can be added by dropping another entry into
 * `SANDBOX_PAYMENT_METHODS` without touching the tile component.
 *
 * SANDBOX ONLY: these figures are experiments. Klarna and Zopa are NOT
 * integrated — no application, credit check or payment can ever happen here,
 * and nothing is pushed live.
 */

import type { SandboxTermPrice } from '@/lib/pricing/sandboxStep3Pricing';

export type SandboxPaymentMethodId =
  | 'instalments12'
  | 'payInFull'
  | 'bawPayLater'
  | 'klarna'
  | 'zopa';

export interface SandboxPaymentSettings {
  payLater: {
    enabled: boolean;
    /** Yearly-collection uplift in percent (live rule: 10). */
    upliftPct: number;
    offerOn24: boolean;
    offerOn36: boolean;
  };
  klarna: {
    enabled: boolean;
    /** "Pay in N" interest-free instalments (Klarna's classic is 3). */
    instalments: number;
  };
  zopa: {
    enabled: boolean;
    /** Representative APR in percent. */
    aprPct: number;
    /** Loan length in months. */
    termMonths: number;
  };
}

export const DEFAULT_PAYMENT_SETTINGS: SandboxPaymentSettings = {
  payLater: { enabled: true, upliftPct: 10, offerOn24: true, offerOn36: true },
  klarna: { enabled: false, instalments: 3 },
  zopa: { enabled: false, aprPct: 19.9, termMonths: 24 },
};

/** True when every payment setting matches the live site exactly. */
export function paymentSettingsAreLive(s: SandboxPaymentSettings | null | undefined): boolean {
  if (!s) return true;
  return (
    s.payLater.enabled === true &&
    (Number(s.payLater.upliftPct) ?? 10) === 10 &&
    s.payLater.offerOn24 === true &&
    s.payLater.offerOn36 === true &&
    s.klarna.enabled === false &&
    s.zopa.enabled === false
  );
}

export interface SandboxPaymentQuote {
  id: SandboxPaymentMethodId;
  label: string;
  /** Per-payment amount in whole pounds. */
  amount: number;
  unit: 'mo' | 'yr' | 'once' | 'payment';
  /** How many payments the customer makes in total. */
  payments: number;
  /** Everything the customer pays across the whole plan. */
  total: number;
  /** Short explainer line shown under the figure. */
  note: string;
  /** Experimental methods are flagged so nobody mistakes them for live options. */
  experimental: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Klarna-style "Pay in N": equal interest-free slices, whole pounds. */
export function klarnaQuote(termTotal: number, instalments: number): SandboxPaymentQuote {
  const total = Math.max(0, Math.round(Number(termTotal) || 0));
  const n = clamp(Math.round(Number(instalments) || 3), 2, 4);
  const per = total > 0 ? Math.ceil(total / n) : 0;
  return {
    id: 'klarna',
    label: `Klarna — pay in ${n}`,
    amount: per,
    unit: 'payment',
    payments: n,
    total: per * n,
    note: `${n} interest-free payments, one every 30 days`,
    experimental: true,
  };
}

/**
 * Zopa-style personal loan: standard amortised monthly payment at a
 * representative APR. r = APR/1200; pmt = P·r / (1 − (1+r)^−n).
 */
export function zopaQuote(termTotal: number, aprPct: number, termMonths: number): SandboxPaymentQuote {
  const total = Math.max(0, Math.round(Number(termTotal) || 0));
  const n = clamp(Math.round(Number(termMonths) || 24), 6, 48);
  const apr = clamp(Number(aprPct) || 0, 0, 60);
  const r = apr / 1200;
  const pmt = total <= 0 ? 0 : r === 0 ? total / n : (total * r) / (1 - Math.pow(1 + r, -n));
  const per = Math.ceil(pmt);
  return {
    id: 'zopa',
    label: 'Zopa — monthly loan',
    amount: per,
    unit: 'mo',
    payments: n,
    total: per * n,
    note: `${n} monthly payments at ${apr}% representative APR`,
    experimental: true,
  };
}

/**
 * Every enabled way to pay for one term tile, in display order. The 12-
 * instalment plan and pay-in-full always exist; the rest follow the settings.
 */
export function computePaymentMethods(
  term: SandboxTermPrice,
  settings: SandboxPaymentSettings,
): SandboxPaymentQuote[] {
  const quotes: SandboxPaymentQuote[] = [
    {
      id: 'instalments12',
      label: '12 monthly payments',
      amount: term.monthly,
      unit: 'mo',
      payments: 12,
      total: term.total,
      note: 'pay over 12 months and save',
      experimental: false,
    },
  ];

  const payLaterOffered =
    settings.payLater.enabled &&
    term.payLaterYearly != null &&
    ((term.years === 2 && settings.payLater.offerOn24) ||
      (term.years === 3 && settings.payLater.offerOn36));
  if (payLaterOffered && term.payLaterYearly != null && term.payLaterTermTotal != null) {
    quotes.push({
      id: 'bawPayLater',
      label: 'BAW PayLater',
      amount: term.payLaterYearly,
      unit: 'yr',
      payments: term.years,
      total: term.payLaterTermTotal,
      note: `Collected once a year · £${term.payLaterTermTotal.toLocaleString()} over ${term.years} years`,
      experimental: false,
    });
  }

  if (settings.klarna.enabled) {
    quotes.push(klarnaQuote(term.total, settings.klarna.instalments));
  }
  if (settings.zopa.enabled) {
    quotes.push(zopaQuote(term.total, settings.zopa.aprPct, settings.zopa.termMonths));
  }

  quotes.push({
    id: 'payInFull',
    label: 'Pay in full today',
    amount: term.payInFull,
    unit: 'once',
    payments: 1,
    total: term.payInFull,
    note:
      term.payInFullSaving > 0
        ? `Save £${term.payInFullSaving.toLocaleString()} versus monthly`
        : 'One payment, nothing more to pay',
    experimental: false,
  });

  return quotes;
}
