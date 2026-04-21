// Server-side price floor for all checkout flows.
// Prevents client-side price manipulation (e.g. user editing finalAmount to £1)
// from creating real Stripe / Bumper / Payment Assist charges.
//
// The floor is a deliberately conservative percentage of the recomputed plan
// base price for the requested term. It allows for legitimate discounts (promo
// codes, voluntary excess discounts, 10% pay-in-full discount) but blocks the
// "set finalAmount to a tiny number" attack class entirely.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface PriceFloorInput {
  planId: string;             // UUID or plan name
  paymentType: string;        // 'monthly' | '12months' | 'yearly' | '24months' | '36months' | etc.
  voluntaryExcess?: number;   // £
  finalAmount: number;        // £ - what the client says the customer should pay
}

export interface PriceFloorResult {
  ok: boolean;
  reason?: string;
  serverBasePrice?: number;
  minimumAllowed?: number;
}

// Hard absolute floor — no warranty in the catalogue is anywhere near this low.
// Stripe's minimum GBP charge is £0.30; we go much higher to make abuse obvious.
export const ABSOLUTE_MIN_GBP = 25;

// Maximum legitimate discount stack (voluntary excess + promo + 10% pay-in-full)
// Anything below 50% of the recomputed plan price is treated as manipulation.
const MIN_PERCENT_OF_BASE = 0.5;

function normalizePaymentType(pt: string): "monthly" | "yearly" | "two_yearly" | "three_yearly" {
  const n = (pt || "").toLowerCase().replace(/[_-\s]/g, "");
  if (n.includes("36") || n.includes("3year") || n.includes("threeyear")) return "three_yearly";
  if (n.includes("24") || n.includes("2year") || n.includes("twoyear")) return "two_yearly";
  if (n === "monthly" || n === "month") return "monthly";
  return "yearly"; // covers 12months, yearly, annual, 1year
}

function getBasePriceFromPlan(plan: any, paymentType: string): number {
  switch (normalizePaymentType(paymentType)) {
    case "monthly": return Number(plan.monthly_price ?? 0) * 12; // monthly price × 12 = total contract value
    case "two_yearly": return Number(plan.two_yearly_price ?? plan.yearly_price * 2 ?? 0);
    case "three_yearly": return Number(plan.three_yearly_price ?? plan.yearly_price * 3 ?? 0);
    case "yearly":
    default: return Number(plan.yearly_price ?? plan.monthly_price * 12 ?? 0);
  }
}

/**
 * Server-side check: is the client-submitted finalAmount within an acceptable
 * range vs. the recomputed plan price for the requested term?
 *
 * Returns { ok: false, reason } if the price looks manipulated and the
 * caller should reject the checkout request with HTTP 400.
 */
export async function validateCheckoutPrice(
  input: PriceFloorInput,
  supabaseAdmin?: SupabaseClient,
): Promise<PriceFloorResult> {
  const { planId, paymentType, finalAmount } = input;

  // 1. Absolute floor — fast reject
  if (!finalAmount || finalAmount < ABSOLUTE_MIN_GBP) {
    return {
      ok: false,
      reason: `Submitted price £${finalAmount} is below the absolute minimum of £${ABSOLUTE_MIN_GBP}. ` +
              `This indicates a manipulated request.`,
    };
  }

  // 2. Recompute plan-based floor from DB
  const supabase = supabaseAdmin ?? createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
  const query = supabase.from("special_vehicle_plans").select("*");
  const { data: plan } = isUUID
    ? await query.eq("id", planId).maybeSingle()
    : await query.ilike("name", planId).maybeSingle();

  if (!plan) {
    // No plan match (admin quote, custom flow). Absolute floor is the only guard.
    return { ok: true, serverBasePrice: 0, minimumAllowed: ABSOLUTE_MIN_GBP };
  }

  const serverBasePrice = getBasePriceFromPlan(plan, paymentType);
  if (!serverBasePrice || serverBasePrice <= 0) {
    return { ok: true, serverBasePrice: 0, minimumAllowed: ABSOLUTE_MIN_GBP };
  }

  const minimumAllowed = Math.max(ABSOLUTE_MIN_GBP, Math.floor(serverBasePrice * MIN_PERCENT_OF_BASE));

  if (finalAmount < minimumAllowed) {
    return {
      ok: false,
      reason: `Submitted price £${finalAmount} is below the minimum allowed £${minimumAllowed} ` +
              `(plan base £${serverBasePrice}). Likely price manipulation.`,
      serverBasePrice,
      minimumAllowed,
    };
  }

  return { ok: true, serverBasePrice, minimumAllowed };
}
