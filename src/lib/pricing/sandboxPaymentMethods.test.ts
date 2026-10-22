import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAYMENT_SETTINGS,
  computePaymentMethods,
  klarnaQuote,
  paymentSettingsAreLive,
  zopaQuote,
  type SandboxPaymentSettings,
} from '@/lib/pricing/sandboxPaymentMethods';
import type { SandboxTermPrice } from '@/lib/pricing/sandboxStep3Pricing';

const twoYearTerm: SandboxTermPrice = {
  term: '24months',
  years: 2,
  monthly: 67,
  total: 804,
  payInFull: 724,
  payInFullSaving: 80,
  payLaterYearly: 442,
  payLaterTermTotal: 884,
  payLaterExtra: 80,
};

const oneYearTerm: SandboxTermPrice = {
  term: '12months',
  years: 1,
  monthly: 42,
  total: 504,
  payInFull: 454,
  payInFullSaving: 50,
  payLaterYearly: null,
  payLaterTermTotal: null,
  payLaterExtra: null,
};

describe('Klarna pay-in-N', () => {
  it('splits the total into equal interest-free payments, rounded up', () => {
    const q = klarnaQuote(804, 3);
    expect(q.amount).toBe(268);
    expect(q.payments).toBe(3);
    expect(q.total).toBe(804);
  });

  it('rounds up when the total does not divide evenly', () => {
    const q = klarnaQuote(500, 3);
    expect(q.amount).toBe(167);
    expect(q.total).toBe(501);
  });

  it('clamps instalments to the 2–4 range', () => {
    expect(klarnaQuote(804, 9).payments).toBe(4);
    expect(klarnaQuote(804, 1).payments).toBe(2);
  });
});

describe('Zopa monthly loan', () => {
  it('at 0% APR the payments are just the total spread over the months', () => {
    const q = zopaQuote(1200, 0, 12);
    expect(q.amount).toBe(100);
    expect(q.total).toBe(1200);
  });

  it('a positive APR costs more than the term total', () => {
    const q = zopaQuote(804, 19.9, 24);
    // Amortised payment at 19.9% APR over 24 months ≈ £40.84 → £41/mo.
    expect(q.amount).toBe(41);
    expect(q.total).toBe(984);
    expect(q.total).toBeGreaterThan(804);
  });

  it('clamps the loan term to 6–48 months', () => {
    expect(zopaQuote(804, 19.9, 120).payments).toBe(48);
  });
});

describe('computePaymentMethods', () => {
  it('live defaults give 12 instalments, PayLater and pay-in-full on 2-year cover', () => {
    const quotes = computePaymentMethods(twoYearTerm, DEFAULT_PAYMENT_SETTINGS);
    expect(quotes.map(q => q.id)).toEqual(['instalments12', 'bawPayLater', 'payInFull']);
  });

  it('never offers PayLater on 1-year cover', () => {
    const quotes = computePaymentMethods(oneYearTerm, DEFAULT_PAYMENT_SETTINGS);
    expect(quotes.map(q => q.id)).toEqual(['instalments12', 'payInFull']);
  });

  it('per-term PayLater switches remove it from that term only', () => {
    const settings: SandboxPaymentSettings = {
      ...DEFAULT_PAYMENT_SETTINGS,
      payLater: { ...DEFAULT_PAYMENT_SETTINGS.payLater, offerOn24: false },
    };
    const quotes = computePaymentMethods(twoYearTerm, settings);
    expect(quotes.map(q => q.id)).toEqual(['instalments12', 'payInFull']);
  });

  it('Klarna and Zopa appear only when enabled, before pay-in-full', () => {
    const settings: SandboxPaymentSettings = {
      ...DEFAULT_PAYMENT_SETTINGS,
      klarna: { enabled: true, instalments: 3 },
      zopa: { enabled: true, aprPct: 19.9, termMonths: 24 },
    };
    const quotes = computePaymentMethods(twoYearTerm, settings);
    expect(quotes.map(q => q.id)).toEqual([
      'instalments12',
      'bawPayLater',
      'klarna',
      'zopa',
      'payInFull',
    ]);
    expect(quotes.find(q => q.id === 'klarna')?.experimental).toBe(true);
    expect(quotes.find(q => q.id === 'zopa')?.experimental).toBe(true);
  });
});

describe('paymentSettingsAreLive', () => {
  it('defaults count as live', () => {
    expect(paymentSettingsAreLive(DEFAULT_PAYMENT_SETTINGS)).toBe(true);
    expect(paymentSettingsAreLive(undefined)).toBe(true);
  });

  it('any experiment flags as not live', () => {
    expect(
      paymentSettingsAreLive({
        ...DEFAULT_PAYMENT_SETTINGS,
        klarna: { enabled: true, instalments: 3 },
      }),
    ).toBe(false);
    expect(
      paymentSettingsAreLive({
        ...DEFAULT_PAYMENT_SETTINGS,
        payLater: { ...DEFAULT_PAYMENT_SETTINGS.payLater, upliftPct: 15 },
      }),
    ).toBe(false);
  });
});
