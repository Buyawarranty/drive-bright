/**
 * RENEWALS SANDBOX — context-aware quote hand-off (Stage 6, Step 17)
 * ---------------------------------------------------------------------------
 * We do NOT build a second quoting tool. This just describes what the existing
 * Quote action would be pre-filled with when the lead type is RENEWAL, so an
 * agent never re-types anything we already hold. In sandbox it is display only;
 * once the engine is live the same object is handed to Quotes & Orders.
 */

import type { SandboxRow } from './types';
import type { RenewalQuote } from './renewalPricing';
import { daysToEffectiveExpiry, getEffectiveEndDate } from './renewalPricing';

export interface RenewalQuotePrefill {
  leadType: 'RENEWAL';
  customerId: string | null;
  customerName: string;
  email: string | null;
  phone: string | null;
  registration: string | null;
  vehicle: string | null;
  mileage: string | null;
  existingPolicyNumber: string | null;
  existingPlan: string | null;
  existingClaimLimit: number | null;
  existingExcess: number | null;
  existingExpiry: string | null;
  daysRemaining: number | null;
  previousPrice: number | null;
  recommendedPrice: number | null;
  negotiationFrom: number | null;
  negotiationTo: number | null;
  paymentPeriod: string | null;
  labourRate: number | null;
}

export function buildRenewalQuotePrefill(
  row: SandboxRow,
  quote: RenewalQuote | null,
): RenewalQuotePrefill {
  const c = row.customers || null;
  return {
    leadType: 'RENEWAL',
    customerId: row.customer_id ?? c?.id ?? null,
    customerName:
      [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || row.customer_full_name || '',
    email: c?.email ?? row.email ?? null,
    phone: c?.phone ?? null,
    registration: c?.registration_plate ?? null,
    vehicle: [c?.vehicle_make, c?.vehicle_model].filter(Boolean).join(' ') || null,
    mileage: c?.mileage ?? null,
    existingPolicyNumber: row.policy_number ?? null,
    existingPlan: row.plan_type ?? null,
    existingClaimLimit: row.claim_limit ?? null,
    existingExcess: row.voluntary_excess ?? null,
    existingExpiry: getEffectiveEndDate(row),
    daysRemaining: daysToEffectiveExpiry(row),

    previousPrice: quote?.previousPrice ?? row.payment_amount ?? null,
    recommendedPrice: quote?.loyaltyPrice ?? null,
    negotiationFrom: quote?.agentFloorPrice ?? null,
    negotiationTo: quote?.standardPrice ?? null,
    paymentPeriod: quote?.paymentPeriod ?? null,
    labourRate: quote?.labourRate ?? null,
  };
}

/** Fields that are still missing and would have to be typed by the agent. */
export function missingPrefillFields(p: RenewalQuotePrefill): string[] {
  const gaps: string[] = [];
  if (!p.customerName) gaps.push('Customer name');
  if (!p.registration) gaps.push('Registration');
  if (!p.vehicle) gaps.push('Vehicle');
  if (!p.mileage) gaps.push('Mileage');
  if (!p.phone && !p.email) gaps.push('Phone or email');
  if (!p.recommendedPrice) gaps.push('Recommended price');
  return gaps;
}
