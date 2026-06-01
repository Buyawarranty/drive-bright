// Migrate "silent" auto-apply promo codes into the shared promo store BEFORE Step 3
// renders. Previously these only auto-applied inside Step 4, which caused the price
// to suddenly change between Step 3 (£50) and Step 4 (£42) — a confusing UX bug.
//
// Sources migrated:
//  - localStorage.autoApplyDiscountCode      (RETURN20-*  → 20% percentage)
//  - localStorage.secondWarrantyDiscountCode (SECOND10-*  → 10% percentage)
//
// Destination:
//  - localStorage.buyawarranty_appliedDiscountCodes  (read by Step 3 sticky AND Step 4)
//
// Safe to call repeatedly — it's idempotent (de-dupes by code) and a no-op server-side.

const STORAGE_KEY = 'buyawarranty_appliedDiscountCodes';

interface AppliedCode {
  code: string;
  type: 'percentage' | 'fixed' | string;
  value: number;
  discountAmount?: number;
  stripe_coupon_id?: string;
  stripe_promo_code_id?: string;
}

function readExisting(): AppliedCode[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function migrateAutoApplyPromos(): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readExisting();
    const has = (code: string) => existing.some((c) => c.code === code);
    const next = [...existing];
    let changed = false;

    const ret = window.localStorage.getItem('autoApplyDiscountCode');
    if (ret && ret.startsWith('RETURN20-')) {
      if (!has(ret)) {
        next.push({ code: ret, type: 'percentage', value: 20, discountAmount: 0 });
        changed = true;
      }
      window.localStorage.removeItem('autoApplyDiscountCode');
    }

    const sec = window.localStorage.getItem('secondWarrantyDiscountCode');
    if (sec && sec.startsWith('SECOND10-')) {
      if (!has(sec)) {
        next.push({ code: sec, type: 'percentage', value: 10, discountAmount: 0 });
        changed = true;
      }
      // Keep secondWarrantyDiscountCode in place — other parts of the journey may need it.
    }

    if (changed) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('promoCodesChanged'));
    }
  } catch (err) {
    console.error('migrateAutoApplyPromos failed', err);
  }
}
