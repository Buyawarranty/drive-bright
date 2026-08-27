/**
 * RENEWALS SANDBOX — reporting groundwork (Stage 8, Step 24)
 * ---------------------------------------------------------------------------
 * Turns the rows currently in view into the numbers a renewals report needs:
 * retention windows, value at risk, ownership health and win-back potential.
 * Pure aggregation — no queries, no writes. The CSV shape below is the shape
 * the live report will use, so nothing has to be re-derived later.
 */

import type { SandboxRow } from './types';
import { daysToExpiry, getLifecycle, priceRenewal, LIFECYCLE_LABEL } from './renewalPricing';
import { evaluateOwnership } from './renewalOwnership';
import { estimateCommission } from './renewalCommission';
import { scoreRenewalPriority } from './renewalPriority';

export interface RenewalSegment {
  id: string;
  label: string;
  count: number;
  value: number;
  hint: string;
}

export interface RenewalAnalytics {
  segments: RenewalSegment[];
  totalValue: number;
  averageOffer: number;
  slaBreached: number;
  unowned: number;
  callbackProtected: number;
}

const inBand = (d: number | null, lo: number, hi: number) => d !== null && d >= lo && d <= hi;

export function analyseRenewals(rows: SandboxRow[]): RenewalAnalytics {
  const priced = rows.map((row) => {
    const q = priceRenewal(row);
    const own = evaluateOwnership(row);
    return {
      row,
      days: daysToExpiry(row.policy_end_date),
      value: q.blocked ? 0 : q.loyaltyPrice,
      blocked: q.blocked,
      own,
    };
  });

  const sum = (pick: (p: typeof priced[number]) => boolean) =>
    priced.filter(pick).reduce((t, p) => t + p.value, 0);
  const num = (pick: (p: typeof priced[number]) => boolean) => priced.filter(pick).length;

  const segments: RenewalSegment[] = [
    { id: 'hot', label: 'Hot (0–7 days)', count: num((p) => inBand(p.days, 0, 7)), value: sum((p) => inBand(p.days, 0, 7)), hint: 'Highest risk of lapsing.' },
    { id: 'due_8_30', label: 'Due 8–30 days', count: num((p) => inBand(p.days, 8, 30)), value: sum((p) => inBand(p.days, 8, 30)), hint: 'The main working window.' },
    { id: 'due_31_60', label: 'Due 31–60 days', count: num((p) => inBand(p.days, 31, 60)), value: sum((p) => inBand(p.days, 31, 60)), hint: 'Early contact window.' },
    { id: 'lapsed', label: 'Lapsed (win-back)', count: num((p) => p.days !== null && p.days < 0), value: sum((p) => p.days !== null && p.days < 0), hint: 'Already expired — win-back rate applies.' },
    { id: 'needs_review', label: 'Needs manager review', count: num((p) => p.blocked), value: 0, hint: 'Cannot be priced automatically.' },
  ];

  const totalValue = Math.round(priced.reduce((t, p) => t + p.value, 0));
  const pricedCount = priced.filter((p) => !p.blocked).length;

  return {
    segments: segments.map((s) => ({ ...s, value: Math.round(s.value) })),
    totalValue,
    averageOffer: pricedCount ? Math.round(totalValue / pricedCount) : 0,
    slaBreached: priced.filter((p) => p.own.slaState === 'breached').length,
    unowned: priced.filter((p) => p.own.slaState === 'unowned').length,
    callbackProtected: priced.filter((p) => p.own.slaState === 'callback_protected').length,
  };
}

/** Row-level export, one line per renewal — the future report's source shape. */
export function renewalsReportCsv(rows: SandboxRow[]): string {
  const head = [
    'Policy number', 'Customer', 'Phone', 'Email', 'Registration', 'Vehicle', 'Plan',
    'Expires', 'Days to expiry', 'Lifecycle', 'Paid last time', 'Loyalty offer',
    'Agent floor', 'Absolute minimum', 'Priority score', 'Priority band',
    'Original selling agent id', 'Current owner id', 'SLA state', 'Next action',
    'Commission rule', 'Commission %', 'Estimated commission',
  ];

  const lines = rows.map((row) => {
    const c = row.customers;
    const q = priceRenewal(row);
    const own = evaluateOwnership(row);
    const prio = scoreRenewalPriority(row, {}, own);
    const est = estimateCommission(row, q.blocked ? 0 : q.loyaltyPrice);
    return [
      row.policy_number || '',
      [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || row.customer_full_name || '',
      c?.phone || '',
      c?.email || row.email || '',
      c?.registration_plate || '',
      [c?.vehicle_make, c?.vehicle_model].filter(Boolean).join(' '),
      row.plan_type || '',
      row.policy_end_date || '',
      daysToExpiry(row.policy_end_date) ?? '',
      LIFECYCLE_LABEL[getLifecycle(row)],
      row.payment_amount ?? '',
      q.blocked ? '' : q.loyaltyPrice,
      q.blocked ? '' : q.agentFloorPrice,
      q.blocked ? '' : q.netFloor,
      prio.score,
      prio.label,
      own.originalAgentId || '',
      own.ownerId || '',
      own.slaState,
      own.nextAction,
      est.kind,
      est.pct,
      est.amount,
    ];
  });

  return [head, ...lines]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
