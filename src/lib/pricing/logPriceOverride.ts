import { supabase } from '@/integrations/supabase/client';

/**
 * Audit trail for manual price overrides (Option C).
 *
 * Purely observational: nothing here blocks or changes a price. It records who
 * typed a custom price, what they typed, what the live matrix would have quoted,
 * and how far below the floor it landed — so managers can review it in
 * Admin → Discounts given → "Manual price overrides".
 */
export interface PriceOverrideAuditInput {
  adminUserId?: string | null;
  userId?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  context?: 'quotes_and_orders' | 'quote_link' | 'confirm_payment';
  customerName?: string | null;
  customerEmail?: string | null;
  vehicleReg?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  paymentType?: string | null;
  excessAmount?: number | null;
  claimLimit?: number | null;
  labourRate?: number | null;
  matrixTotal: number;
  matrixMonthly?: number | null;
  enteredTotal: number;
  enteredMonthly?: number | null;
  floorAmount?: number | null;
  priceMatchMode?: boolean;
  priceMatchCompany?: string | null;
  priceMatchPrice?: number | null;
  notes?: string | null;
}

/** Fire-and-forget — a logging failure must never block sending a quote. */
export const logPriceOverride = (input: PriceOverrideAuditInput): void => {
  try {
    const matrixTotal = Number(input.matrixTotal) || 0;
    const enteredTotal = Number(input.enteredTotal) || 0;
    if (!enteredTotal || !matrixTotal) return;
    // Nothing to audit when the agent is on (or above) the grid price.
    if (Math.abs(enteredTotal - matrixTotal) < 0.5) return;

    const diffAmount = Math.round((enteredTotal - matrixTotal) * 100) / 100;
    const diffPct = Math.round(((enteredTotal - matrixTotal) / matrixTotal) * 1000) / 10;
    const floorAmount = input.floorAmount ?? null;

    void supabase
      .from('price_override_audit')
      .insert({
        admin_user_id: input.adminUserId ?? null,
        user_id: input.userId ?? null,
        agent_name: input.agentName ?? null,
        agent_email: input.agentEmail ?? null,
        context: input.context || 'quotes_and_orders',
        customer_name: input.customerName ?? null,
        customer_email: input.customerEmail ?? null,
        vehicle_reg: input.vehicleReg ?? null,
        vehicle_make: input.vehicleMake ?? null,
        vehicle_model: input.vehicleModel ?? null,
        payment_type: input.paymentType ?? null,
        excess_amount: input.excessAmount ?? null,
        claim_limit: input.claimLimit ?? null,
        labour_rate: input.labourRate ?? null,
        matrix_total: matrixTotal,
        matrix_monthly: input.matrixMonthly ?? null,
        entered_total: enteredTotal,
        entered_monthly: input.enteredMonthly ?? null,
        diff_amount: diffAmount,
        diff_pct: diffPct,
        floor_amount: floorAmount,
        below_floor: floorAmount != null ? enteredTotal < floorAmount : false,
        price_match_mode: !!input.priceMatchMode,
        price_match_company: input.priceMatchCompany ?? null,
        price_match_price: input.priceMatchPrice ?? null,
        notes: input.notes ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn('logPriceOverride failed', error);
      });
  } catch (e) {
    console.warn('logPriceOverride threw', e);
  }
};
