/**
 * RENEWALS SANDBOX — ownership + SLA rules (Stage 4–5, Steps 11, 13–15)
 * ---------------------------------------------------------------------------
 * Pure functions only. Nothing here reads or writes the database; the sandbox
 * uses it to show who a renewal WOULD belong to and when it would fall back to
 * the renewal pool once the engine is switched live.
 *
 * Rules mirror the live lead rules:
 *  - The ORIGINAL selling agent and the CURRENT owner are two separate things.
 *    The original agent gets first opportunity, never permanent ownership.
 *  - Owner-sticky: qualifying activity (call, SMS, email, quote, callback)
 *    retains ownership.
 *  - No qualifying activity inside the configurable first-touch SLA and the
 *    renewal becomes eligible for the Open Pool.
 *  - A booked future callback protects ownership until the callback SLA runs out.
 *  - Close to expiry, retention beats historic ownership.
 */

import { daysToEffectiveExpiry } from './renewalPricing';
import { getRenewalSlaConfig, slaHoursFromConfig } from './renewalSlaConfig';
import type { SandboxRow } from './types';

export type SlaState = 'in_sla' | 'due_now' | 'breached' | 'unowned' | 'callback_protected';

/** First-touch SLA in hours, by how close the policy is to expiring. */
export function slaHoursFor(daysLeft: number | null): number {
  return slaHoursFromConfig(daysLeft);
}

export type QualifyingActivity =
  | 'call'
  | 'answered_call'
  | 'sms'
  | 'email'
  | 'quote'
  | 'callback'
  | 'renewal_discussion';

export const QUALIFYING_ACTIVITY_LABEL: Record<QualifyingActivity, string> = {
  call: 'Outbound call',
  answered_call: 'Answered conversation',
  sms: 'SMS sent',
  email: 'Email sent',
  quote: 'Quote created',
  callback: 'Callback booked',
  renewal_discussion: 'Renewal discussed',
};

export interface OwnershipInputs {
  /** Last qualifying activity timestamp (ISO) — resets the SLA clock. */
  lastTouchedAt?: string | null;
  /** What that activity was, for display. */
  lastActivity?: QualifyingActivity | null;
  /** A scheduled future callback (ISO) protects ownership. */
  callbackAt?: string | null;
  /** Whether the original selling agent is still active/eligible. */
  originalAgentActive?: boolean;
}

export interface RenewalOwnership {
  /** admin_users.id of the agent who originally sold the warranty. */
  originalAgentId: string | null;
  /** admin_users.id the renewal would currently be worked by. */
  ownerId: string | null;
  /** Why that owner was chosen. */
  reason:
    | 'sticky_customer_owner'
    | 'original_selling_agent_first_opportunity'
    | 'pool_round_robin'
    | 'retention_priority';
  slaHours: number;
  slaState: SlaState;
  /** Hours left before the first-touch SLA is missed (negative once breached). */
  hoursRemaining: number | null;
  /** True when the renewal is eligible to drop into the Open Pool. */
  poolEligible: boolean;
  lastActivity: QualifyingActivity | null;
  lastActivityAt: string | null;
  /** The next thing an agent should do with this renewal. */
  nextAction: string;
}

/** Agent who originally sold the policy — stored separately from the owner. */
export function originalSellingAgentId(row: SandboxRow): string | null {
  return row.quote_sent_by || row.payment_confirmed_by || null;
}

export function evaluateOwnership(row: SandboxRow, opts: OwnershipInputs = {}): RenewalOwnership {
  const cfg = getRenewalSlaConfig();
  const currentOwnerId = row.customers?.assigned_to || null;
  const originalAgentId = originalSellingAgentId(row);
  const d = daysToEffectiveExpiry(row);
  const slaHours = slaHoursFor(d);
  const lastActivity = opts.lastActivity ?? null;
  const lastActivityAt = opts.lastTouchedAt ?? null;

  // A booked future callback protects ownership until the callback SLA expires.
  if (currentOwnerId && opts.callbackAt) {
    const dueIn = (new Date(opts.callbackAt).getTime() - Date.now()) / 3600000;
    if (dueIn > -cfg.callbackProtectionHours) {
      return {
        originalAgentId,
        ownerId: currentOwnerId,
        reason: 'sticky_customer_owner',
        slaHours,
        slaState: 'callback_protected',
        hoursRemaining: Math.round(dueIn),
        poolEligible: false,
        lastActivity,
        lastActivityAt,
        nextAction: dueIn > 0 ? 'Callback booked — hold until due' : 'Callback due now',
      };
    }
  }

  const ownerId = currentOwnerId
    ?? (opts.originalAgentActive === false ? null : originalAgentId);

  if (!ownerId) {
    return {
      originalAgentId,
      ownerId: null,
      reason: 'pool_round_robin',
      slaHours,
      slaState: 'unowned',
      hoursRemaining: null,
      poolEligible: true,
      lastActivity,
      lastActivityAt,
      nextAction: 'Allocate to an agent or let the pool pick it up',
    };
  }

  const reason: RenewalOwnership['reason'] = currentOwnerId
    ? 'sticky_customer_owner'
    : 'original_selling_agent_first_opportunity';

  const anchor = lastActivityAt || row.policy_start_date || null;
  if (!anchor) {
    return {
      originalAgentId,
      ownerId,
      reason,
      slaHours,
      slaState: 'in_sla',
      hoursRemaining: slaHours,
      poolEligible: false,
      lastActivity,
      lastActivityAt,
      nextAction: 'First renewal call',
    };
  }

  const elapsedHours = (Date.now() - new Date(anchor).getTime()) / 3600000;
  const hoursRemaining = Math.round(slaHours - elapsedHours);
  const breached = hoursRemaining <= 0;
  const slaState: SlaState = breached
    ? 'breached'
    : hoursRemaining <= Math.max(1, slaHours * 0.25)
      ? 'due_now'
      : 'in_sla';

  // Close to expiry, retention takes priority over historic ownership.
  const retentionPriority =
    breached && d !== null && d <= cfg.retentionOverridesOwnershipDays;

  return {
    originalAgentId,
    ownerId,
    reason: retentionPriority ? 'retention_priority' : reason,
    slaHours,
    slaState,
    hoursRemaining,
    poolEligible: breached,
    lastActivity,
    lastActivityAt,
    nextAction: breached
      ? retentionPriority
        ? 'Expiring soon and untouched — release to the pool now'
        : 'SLA missed — release to the pool'
      : slaState === 'due_now'
        ? 'Call now to keep ownership'
        : 'Keep working — within SLA',
  };
}

export const SLA_LABEL: Record<SlaState, string> = {
  in_sla: 'Within SLA',
  due_now: 'Call due now',
  breached: 'SLA missed — pool eligible',
  unowned: 'No owner — goes to the pool',
  callback_protected: 'Callback booked — protected',
};

export const SLA_TONE: Record<SlaState, string> = {
  in_sla: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  due_now: 'border-amber-200 bg-amber-50 text-amber-900',
  breached: 'border-red-200 bg-red-50 text-red-800',
  unowned: 'border-slate-200 bg-slate-100 text-slate-700',
  callback_protected: 'border-blue-200 bg-blue-50 text-blue-800',
};

export const OWNERSHIP_REASON_LABEL: Record<RenewalOwnership['reason'], string> = {
  sticky_customer_owner: 'Sticky — existing customer owner',
  original_selling_agent_first_opportunity: 'Original selling agent — first opportunity',
  pool_round_robin: 'No current owner — Open Pool round robin',
  retention_priority: 'Retention priority — beats historic ownership',
};
