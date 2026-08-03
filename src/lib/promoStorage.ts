// Shared helpers for the persistent promo code applied across the checkout flow.
// The canonical storage key is owned by StreamlinedCheckout — we just read it here
// so Step 3 can mirror the discount before the user reaches Step 4.

import { minimumPriceForCodes } from '@/lib/testPromoBypass';

const STORAGE_KEY = 'buyawarranty_appliedDiscountCodes';

export interface PersistedPromoCode {
  code: string;
  type: 'percentage' | 'fixed' | string;
  value: number;
  discountAmount?: number;
  stripe_coupon_id?: string;
  stripe_promo_code_id?: string;
}

/**
 * Admin preview suppression: while set, every promo read returns [] so the
 * Price Updates → Step 3 preview shows the raw grid prices (no stale 99% test
 * code leaking in and making the summary say £1 while the cards say £107).
 */
let promoSuppressed = false;

export function setPromoSuppressed(next: boolean) {
  if (promoSuppressed === next) return;
  promoSuppressed = next;
  try {
    window.dispatchEvent(new Event('promoCodesChanged'));
  } catch {
    /* noop */
  }
}

export function isPromoSuppressed(): boolean {
  return promoSuppressed;
}

export function readAppliedPromos(): PersistedPromoCode[] {
  try {
    if (typeof window === 'undefined') return [];
    if (promoSuppressed) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


export function clearAppliedPromos() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('promoCodesChanged'));
  } catch {
    /* noop */
  }
}

/** Discount amount (in pounds, integer) for a given base price. */
export function calcPromoDiscount(basePrice: number, codes: PersistedPromoCode[] = readAppliedPromos()): number {
  if (!codes.length || basePrice <= 0) return 0;
  const raw = codes.reduce((sum, c) => {
    const amt = c.type === 'percentage' ? basePrice * (c.value / 100) : c.value;
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);
  // Cap so we never go below the applicable price floor (£120 normally,
  // £1 for manager TEST codes) — keeps Step 3 and Step 4 totals identical.
  const floor = promoPriceFloor(codes);
  return Math.min(Math.floor(raw), Math.max(0, basePrice - floor));
}

/** Price floor that applies given the persisted promo codes. */
export function promoPriceFloor(codes: PersistedPromoCode[] = readAppliedPromos()): number {
  return minimumPriceForCodes(codes as Array<{ code: string }>);
}

/** React hook: re-renders when the persisted promo changes (incl. cross-tab). */
import { useEffect, useState } from 'react';

export function useAppliedPromos(): PersistedPromoCode[] {
  const [codes, setCodes] = useState<PersistedPromoCode[]>(() => readAppliedPromos());

  useEffect(() => {
    const refresh = () => setCodes(readAppliedPromos());
    window.addEventListener('storage', refresh);
    window.addEventListener('promoCodesChanged', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('promoCodesChanged', refresh);
    };
  }, []);

  return codes;
}
