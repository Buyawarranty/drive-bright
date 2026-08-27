/**
 * RENEWALS SANDBOX — configurable queue priority (Stage 6, Step 16)
 * ---------------------------------------------------------------------------
 * Nothing is sorted by "created date" alone and no weighting is hard-coded into
 * a component. Every weight lives here, is editable in the sandbox UI and is
 * stored on the device only, so the ordering can be re-tuned later from real
 * conversion results without touching the components.
 */

import { daysToEffectiveExpiry, getEffectiveEndDate } from './renewalPricing';
import type { SandboxRow } from './types';
import type { RenewalOwnership } from './renewalOwnership';

export interface RenewalPriorityWeights {
  liveInbound: number;
  callbackDueNow: number;
  renewal0to7: number;
  hotEnquiry: number;
  renewal8to14: number;
  standardOpportunity: number;
  renewal15to30: number;
  renewalLater: number;
  lapsed: number;
  /** Extra push once the first-touch SLA has been missed. */
  slaBreachBonus: number;
  /** Extra push when the customer responded (call in, SMS reply, quote request). */
  customerRespondedBonus: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: RenewalPriorityWeights = {
  liveInbound: 100,
  callbackDueNow: 92,
  renewal0to7: 84,
  hotEnquiry: 76,
  renewal8to14: 68,
  standardOpportunity: 60,
  renewal15to30: 52,
  renewalLater: 32,
  lapsed: 40,
  slaBreachBonus: 8,
  customerRespondedBonus: 12,
};

const KEY = 'renewals_sandbox_priority_weights_v1';

let cache: RenewalPriorityWeights | null = null;
const listeners = new Set<() => void>();

export function getPriorityWeights(): RenewalPriorityWeights {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_PRIORITY_WEIGHTS, ...JSON.parse(raw) } : { ...DEFAULT_PRIORITY_WEIGHTS };
  } catch {
    cache = { ...DEFAULT_PRIORITY_WEIGHTS };
  }
  return cache;
}

export function setPriorityWeights(next: Partial<RenewalPriorityWeights>) {
  cache = { ...getPriorityWeights(), ...next };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function resetPriorityWeights() {
  cache = { ...DEFAULT_PRIORITY_WEIGHTS };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribePriorityWeights(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export interface PrioritySignals {
  /** Customer is on the phone / just called in. */
  liveInbound?: boolean;
  /** A booked callback is due now or overdue. */
  callbackDueNow?: boolean;
  /** Customer replied to SMS/email, asked for a quote or booked a callback. */
  customerResponded?: boolean;
  /** First-touch SLA already missed. */
  slaBreached?: boolean;
}

export interface RenewalPriority {
  score: number;
  band:
    | 'live_inbound'
    | 'callback_due'
    | 'renewal_0_7'
    | 'renewal_8_14'
    | 'renewal_15_30'
    | 'renewal_later'
    | 'lapsed';
  label: string;
  reason: string;
}

export const PRIORITY_TONE: Record<RenewalPriority['band'], string> = {
  live_inbound: 'border-blue-200 bg-blue-50 text-blue-800',
  callback_due: 'border-amber-200 bg-amber-50 text-amber-900',
  renewal_0_7: 'border-red-200 bg-red-50 text-red-800',
  renewal_8_14: 'border-orange-200 bg-orange-50 text-orange-900',
  renewal_15_30: 'border-amber-200 bg-amber-50 text-amber-900',
  renewal_later: 'border-slate-200 bg-slate-100 text-slate-700',
  lapsed: 'border-slate-300 bg-slate-200 text-slate-800',
};

const LABEL: Record<RenewalPriority['band'], string> = {
  live_inbound: 'Live inbound',
  callback_due: 'Callback due now',
  renewal_0_7: 'Urgent renewal',
  renewal_8_14: 'Priority renewal',
  renewal_15_30: 'Active renewal',
  renewal_later: 'Upcoming renewal',
  lapsed: 'Lapsed / win-back',
};

/** Priority for one renewal, using the configurable weights. */
export function scoreRenewalPriority(
  row: SandboxRow,
  signals: PrioritySignals = {},
  ownership?: RenewalOwnership | null,
): RenewalPriority {
  const w = getPriorityWeights();
  const d = daysToEffectiveExpiry(row);

  let band: RenewalPriority['band'];
  let base: number;
  let reason: string;

  if (signals.liveInbound) {
    band = 'live_inbound'; base = w.liveInbound; reason = 'Customer is on the line';
  } else if (signals.callbackDueNow) {
    band = 'callback_due'; base = w.callbackDueNow; reason = 'Booked callback is due';
  } else if (d === null) {
    band = 'renewal_later'; base = w.renewalLater; reason = 'No expiry date on the policy';
  } else if (d < 0) {
    band = 'lapsed'; base = w.lapsed; reason = 'Policy already expired — win-back';
  } else if (d <= 7) {
    band = 'renewal_0_7'; base = w.renewal0to7; reason = 'Expires within 7 days';
  } else if (d <= 14) {
    band = 'renewal_8_14'; base = w.renewal8to14; reason = 'Expires in 8–14 days';
  } else if (d <= 30) {
    band = 'renewal_15_30'; base = w.renewal15to30; reason = 'Expires in 15–30 days';
  } else {
    band = 'renewal_later'; base = w.renewalLater; reason = 'Expires in more than 30 days';
  }

  let score = base;
  const breached = signals.slaBreached ?? ownership?.slaState === 'breached';
  if (breached) { score += w.slaBreachBonus; reason += ' · first-touch SLA missed'; }
  if (signals.customerResponded) { score += w.customerRespondedBonus; reason += ' · customer responded'; }

  return { score: Math.round(score), band, label: LABEL[band], reason };
}

/** Highest priority first; expiry date settles ties instead of created date. */
export function sortByPriority(rows: SandboxRow[]): SandboxRow[] {
  return [...rows].sort((a, b) => {
    const diff = scoreRenewalPriority(b).score - scoreRenewalPriority(a).score;
    if (diff !== 0) return diff;
    const eaDate = getEffectiveEndDate(a);
    const ea = eaDate ? new Date(eaDate).getTime() : Infinity;
    const ebDate = getEffectiveEndDate(b);
    const eb = ebDate ? new Date(ebDate).getTime() : Infinity;
    return ea - eb;
  });
}
