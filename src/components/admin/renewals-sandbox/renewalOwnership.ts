/**
 * RENEWALS SANDBOX — ownership + SLA rules (Stage 4, Step 11)
 * ---------------------------------------------------------------------------
 * Pure functions only. Nothing here reads or writes the database; the sandbox
 * uses it to show who a renewal WOULD belong to and when it would fall back to
 * the renewal pool once the engine is switched live.
 *
 * Rules mirror the live lead rules:
 *  - Owner-sticky: if the customer already sits with an agent, the renewal
 *    stays with that agent — never round-robin over the top of them.
 *  - Each priority band gets its own first-touch SLA. Miss it and the renewal
 *    is eligible for the pool so it never goes cold.
 */

import { daysToExpiry } from './renewalPricing';
import type { SandboxRow } from './types';

export type SlaState = 'in_sla' | 'due_now' | 'breached' | 'unowned';

/** First-touch SLA in hours, by how close the policy is to expiring. */
export function slaHoursFor(daysLeft: number | null): number {
  if (daysLeft === null) return 72;
  if (daysLeft < 0) return 24;   // lapsed — recover fast
  if (daysLeft <= 7) return 4;   // hot
  if (daysLeft <= 14) return 24;
  if (daysLeft <= 30) return 48;
  return 72;
}

export interface RenewalOwnership {
  /** admin_users.id the renewal would be assigned to, when we have one. */
  ownerId: string | null;
  /** Why that owner was chosen. */
  reason: 'sticky_customer_owner' | 'pool_round_robin';
  slaHours: number;
  slaState: SlaState;
  /** Hours left before the first-touch SLA is missed (negative once breached). */
  hoursRemaining: number | null;
  /** True when the renewal is eligible to drop into the renewal pool. */
  poolEligible: boolean;
}

export function evaluateOwnership(
  row: SandboxRow,
  opts: { lastTouchedAt?: string | null } = {},
): RenewalOwnership {
  const ownerId = row.customers?.assigned_to || null;
  const d = daysToExpiry(row.policy_end_date);
  const slaHours = slaHoursFor(d);

  if (!ownerId) {
    return {
      ownerId: null,
      reason: 'pool_round_robin',
      slaHours,
      slaState: 'unowned',
      hoursRemaining: null,
      poolEligible: true,
    };
  }

  const anchor = opts.lastTouchedAt || row.policy_start_date || null;
  if (!anchor) {
    return {
      ownerId,
      reason: 'sticky_customer_owner',
      slaHours,
      slaState: 'in_sla',
      hoursRemaining: slaHours,
      poolEligible: false,
    };
  }

  const elapsedHours = (Date.now() - new Date(anchor).getTime()) / 3600000;
  const hoursRemaining = Math.round(slaHours - elapsedHours);
  const slaState: SlaState =
    hoursRemaining <= 0 ? 'breached' : hoursRemaining <= Math.max(1, slaHours * 0.25) ? 'due_now' : 'in_sla';

  return {
    ownerId,
    reason: 'sticky_customer_owner',
    slaHours,
    slaState,
    hoursRemaining,
    poolEligible: slaState === 'breached',
  };
}

export const SLA_LABEL: Record<SlaState, string> = {
  in_sla: 'Within SLA',
  due_now: 'Call due now',
  breached: 'SLA missed — pool eligible',
  unowned: 'No owner — goes to the pool',
};

export const SLA_TONE: Record<SlaState, string> = {
  in_sla: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  due_now: 'border-amber-200 bg-amber-50 text-amber-900',
  breached: 'border-red-200 bg-red-50 text-red-800',
  unowned: 'border-slate-200 bg-slate-100 text-slate-700',
};
