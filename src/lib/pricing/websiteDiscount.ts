/** One website discount, applied to the completed quote rather than its base. */
export const DEFAULT_WEBSITE_DISCOUNT_PCT = 10;
export const MAX_WEBSITE_DISCOUNT_PCT = 50;
export const WEBSITE_DISCOUNT_CHANGED_EVENT = 'bw:website-discount-draft-changed';
const DRAFT_KEY = 'bw:unified-website-discount';

export function normalizeWebsiteDiscount(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_WEBSITE_DISCOUNT_PCT;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(MAX_WEBSITE_DISCOUNT_PCT, Math.max(0, n)) : DEFAULT_WEBSITE_DISCOUNT_PCT;
}

export function readWebsiteDiscountDraft(): number {
  try { return normalizeWebsiteDiscount(localStorage.getItem(DRAFT_KEY)); }
  catch { return DEFAULT_WEBSITE_DISCOUNT_PCT; }
}

export function saveWebsiteDiscountDraft(pct: number): void {
  try { localStorage.setItem(DRAFT_KEY, String(normalizeWebsiteDiscount(pct))); }
  catch { /* An unavailable browser store must not affect checkout. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WEBSITE_DISCOUNT_CHANGED_EVENT));
}

export function discountedWebsiteTotal(total: number, pct: number, floor: number): number {
  return Math.max(Math.ceil(floor), Math.ceil(total * (1 - normalizeWebsiteDiscount(pct) / 100)));
}