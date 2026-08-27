/**
 * RENEWALS SANDBOX — configurable commission rules (Stage 7, Step 19)
 * ---------------------------------------------------------------------------
 * Commission percentages are NOT hard-coded into components. They live here,
 * are editable by management in the sandbox and are stored in localStorage only
 * (no database writes) until the renewals engine goes live.
 *
 * For an individual renewal the commission is credited to the agent who CLOSES
 * it; the original selling agent is retained separately for reporting.
 */

import type { SandboxRow } from './types';
import { getLifecycle, daysToEffectiveExpiry } from './renewalPricing';

export type SaleKind = 'new_sale' | 'standard_renewal' | 'win_back' | 'upsell';

export interface RenewalCommissionRates {
  newSalePct: number;
  standardRenewalPct: number;
  winBackPct: number;
  upsellPct: number;
}

export const DEFAULT_COMMISSION_RATES: RenewalCommissionRates = {
  newSalePct: 4,
  standardRenewalPct: 2,
  winBackPct: 3,
  upsellPct: 4,
};

export const SALE_KIND_LABEL: Record<SaleKind, string> = {
  new_sale: 'New sale',
  standard_renewal: 'Standard renewal',
  win_back: 'Lapsed / win-back',
  upsell: 'Upsell / additional new business',
};

const KEY = 'renewals_sandbox_commission_rates_v1';

let cache: RenewalCommissionRates | null = null;
const listeners = new Set<() => void>();

export function getCommissionRates(): RenewalCommissionRates {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_COMMISSION_RATES, ...JSON.parse(raw) } : { ...DEFAULT_COMMISSION_RATES };
  } catch {
    cache = { ...DEFAULT_COMMISSION_RATES };
  }
  return cache;
}

export function setCommissionRates(next: Partial<RenewalCommissionRates>) {
  cache = { ...getCommissionRates(), ...next };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function resetCommissionRates() {
  cache = { ...DEFAULT_COMMISSION_RATES };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeCommissionRates(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function ratePctFor(kind: SaleKind, rates = getCommissionRates()): number {
  switch (kind) {
    case 'new_sale': return rates.newSalePct;
    case 'win_back': return rates.winBackPct;
    case 'upsell': return rates.upsellPct;
    default: return rates.standardRenewalPct;
  }
}

/** Work out which commission rule a renewal row falls under. */
export function saleKindFor(row: SandboxRow, opts: { isUpsell?: boolean } = {}): SaleKind {
  if (opts.isUpsell) return 'upsell';
  const lifecycle = getLifecycle(row);
  if (lifecycle === 'lapsed') return 'win_back';
  const d = daysToEffectiveExpiry(row);
  if (d !== null && d < 0) return 'win_back';
  return 'standard_renewal';
}

export interface CommissionEstimate {
  kind: SaleKind;
  pct: number;
  /** Amount the closing agent would earn on the final price. */
  amount: number;
  /** Incremental amount above last year's price, for upsell reporting. */
  incremental: number | null;
}

export function estimateCommission(
  row: SandboxRow,
  finalPrice: number,
  opts: { isUpsell?: boolean; previousPrice?: number | null } = {},
): CommissionEstimate {
  const kind = saleKindFor(row, opts);
  const pct = ratePctFor(kind);
  const price = Number.isFinite(finalPrice) ? Math.max(0, finalPrice) : 0;
  const prev = opts.previousPrice ?? row.payment_amount ?? null;
  return {
    kind,
    pct,
    amount: Math.round(price * (pct / 100) * 100) / 100,
    incremental: typeof prev === 'number' && prev > 0 ? Math.round(price - prev) : null,
  };
}
