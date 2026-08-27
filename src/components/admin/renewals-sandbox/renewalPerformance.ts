/**
 * RENEWALS SANDBOX — performance protection (Stage 8, Step 22)
 * ---------------------------------------------------------------------------
 * Renewal work must never damage an agent's new-business figures. These pure
 * helpers describe how a renewal is counted so the scoreboard stays honest:
 *
 *  - Renewal contacts are counted in a SEPARATE renewal bucket, never mixed
 *    into new-business conversion rates.
 *  - A renewal that is not saved is NOT a lost new-business lead.
 *  - Renewal revenue is reported separately from new sales, and the closing
 *    agent is credited (the original seller is kept for reporting only).
 *  - Working renewals must not reduce an agent's share of new leads.
 *
 * Nothing here reads or writes the database.
 */

import type { SandboxRow } from './types';
import { getLifecycle } from './renewalPricing';
import { estimateCommission, SALE_KIND_LABEL } from './renewalCommission';
import { priceRenewal } from './renewalPricing';

export interface PerformanceRule {
  rule: string;
  detail: string;
}

export const PERFORMANCE_PROTECTION_RULES: PerformanceRule[] = [
  {
    rule: 'Renewals are counted separately',
    detail: 'Renewal calls, quotes and outcomes sit in their own renewal bucket and never dilute new-business conversion.',
  },
  {
    rule: 'A lost renewal is not a lost lead',
    detail: 'A renewal the customer declines does not count as a lost new-business lead against the agent.',
  },
  {
    rule: 'New lead share is unaffected',
    detail: 'Time on renewals does not reduce an agent\'s place in the new-lead rotation; renewals are their own queue.',
  },
  {
    rule: 'Closing agent gets the credit',
    detail: 'Renewal revenue and commission go to whoever closes it. The original seller is retained for reporting only.',
  },
  {
    rule: 'Targets are split',
    detail: 'Renewal revenue reports against a renewal target, so it neither flatters nor penalises the new-sales target.',
  },
];

export interface RenewalPerformanceSplit {
  /** Renewal opportunities in view. */
  opportunities: number;
  /** Renewal revenue at stake at the loyalty price. */
  revenueAtStake: number;
  /** Renewal revenue that is already lapsed and needs winning back. */
  winBackAtStake: number;
  /** Commission the closing agents would earn if every one renewed. */
  commissionIfAllRenewed: number;
  /** Rows needing a manager decision before they can be priced. */
  needsReview: number;
  /** Breakdown by commission rule so new sale vs renewal never blend. */
  byKind: { kind: string; label: string; count: number; revenue: number; commission: number }[];
}

export function splitRenewalPerformance(rows: SandboxRow[]): RenewalPerformanceSplit {
  const byKind = new Map<string, { count: number; revenue: number; commission: number }>();
  let revenueAtStake = 0;
  let winBackAtStake = 0;
  let commissionIfAllRenewed = 0;
  let needsReview = 0;

  for (const row of rows) {
    const quote = priceRenewal(row);
    if (quote.blocked) { needsReview += 1; continue; }
    const price = quote.loyaltyPrice;
    const est = estimateCommission(row, price);
    revenueAtStake += price;
    commissionIfAllRenewed += est.amount;
    if (getLifecycle(row) === 'lapsed') winBackAtStake += price;

    const bucket = byKind.get(est.kind) || { count: 0, revenue: 0, commission: 0 };
    bucket.count += 1;
    bucket.revenue += price;
    bucket.commission += est.amount;
    byKind.set(est.kind, bucket);
  }

  return {
    opportunities: rows.length,
    revenueAtStake: Math.round(revenueAtStake),
    winBackAtStake: Math.round(winBackAtStake),
    commissionIfAllRenewed: Math.round(commissionIfAllRenewed * 100) / 100,
    needsReview,
    byKind: [...byKind.entries()].map(([kind, v]) => ({
      kind,
      label: SALE_KIND_LABEL[kind as keyof typeof SALE_KIND_LABEL] || kind,
      count: v.count,
      revenue: Math.round(v.revenue),
      commission: Math.round(v.commission * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue),
  };
}
