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
  claimLimit?: number;        // £750 | £1250 | £2000
  finalAmount: number;        // £ - what the client says the customer should pay
  discountCode?: string;      // Optional - test codes (TEST*) bypass the floor for anyone
  authHeader?: string | null; // Optional - retained for backwards compatibility; no longer used for gating
  isMotorbike?: boolean;      // Optional - motorbike floors are exactly half
}

// Test discount codes that bypass the £120 absolute floor and 50% plan floor.
// Anyone who knows one of these codes can use it. Any code starting with "TEST"
// is also treated as a test bypass.
const TEST_BYPASS_CODES = new Set<string>([
  "SAVE99GOLDEN",
]);

export function isTestBypassCode(code?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (!c) return false;
  return c.startsWith("TEST") || TEST_BYPASS_CODES.has(c);
}

// When a TEST code is applied, allow the transaction down to £1 (still above
// Stripe's £0.30 minimum) so QA can run realistic low-value flows.
const TEST_MIN_GBP = 1;

export interface PriceFloorResult {
  ok: boolean;
  bypass?: boolean;   // true when a TEST bypass code is present
  reason?: string;
  serverBasePrice?: number;
  minimumAllowed?: number;
}

// Hard absolute floor — the agreed NET sell floor
// (£399 / £769 / £1,099 for 12 / 24 / 36 months, see src/lib/pricing/netFloor.ts).
//
// 13 Sep 2026: promo codes are NO LONGER allowed to take a charge below this
// floor — a SAVE25 on a £480 quote produced a £360 Stripe sale. Every checkout
// (Stripe, Bumper, Payment Assist, multi-warranty) must now respect the full
// term net floor. Only genuine live TEST*/SAVE99GOLDEN codes keep the £1 floor.
// Motorbikes are half price, so the term floor is halved when the caller tells
// us the vehicle is a motorbike.
export const NET_SELL_FLOOR_GBP: Record<"yearly" | "two_yearly" | "three_yearly" | "monthly", number> = {
  monthly: 399,
  yearly: 399,
  two_yearly: 769,
  three_yearly: 1099,
};

/** Server floor for a term: the full net sell floor (halved for motorbikes). */
export function getTermFloorGBP(paymentType: string, isMotorbike?: boolean): number {
  const term = normalizePaymentType(paymentType);
  const netFloor = NET_SELL_FLOOR_GBP[term] ?? NET_SELL_FLOOR_GBP.yearly;
  return isMotorbike === true ? netFloor / 2 : netFloor;
}

// Retained for callers that need a single hard number with no term context.
export const ABSOLUTE_MIN_GBP = 120;


// Maximum legitimate discount stack (voluntary excess + promo + 10% pay-in-full)
// Anything below 50% of the recomputed plan price is treated as manipulation.
const MIN_PERCENT_OF_BASE = 0.5;

// Mirrors the live public checkout pricing matrix used by Step 3/Step 4.
// Keeping the validation source aligned with the public calculator prevents
// valid Stripe amounts from being rejected as "price manipulation".
const CHECKOUT_BASE_PRICING_MATRIX = {
  // Columns are the cover levels: £1,000 / £2,000 / £3,000.
  '12months': {
    0: { 1000: 391, 2000: 416, 3000: 492 },
    50: { 1000: 366, 2000: 383, 3000: 458 },
    100: { 1000: 324, 2000: 349, 3000: 425 },
    150: { 1000: 288, 2000: 324, 3000: 400 },
  },
  '24months': {
    0: { 1000: 752, 2000: 786, 3000: 862 },
    50: { 1000: 694, 2000: 736, 3000: 803 },
    100: { 1000: 618, 2000: 660, 3000: 736 },
    150: { 1000: 584, 2000: 618, 3000: 694 },
  },
  '36months': {
    0: { 1000: 1130, 2000: 1172, 3000: 1256 },
    50: { 1000: 1046, 2000: 1088, 3000: 1172 },
    100: { 1000: 920, 2000: 988, 3000: 1072 },
    150: { 1000: 878, 2000: 920, 3000: 1004 },
  },
} as const;


function normalizeCheckoutDuration(pt: string): keyof typeof CHECKOUT_BASE_PRICING_MATRIX | null {
  const n = (pt || '').toLowerCase().replace(/[_\-\s]/g, '');
  if (n.includes('36') || n.includes('3year') || n.includes('threeyear')) return '36months';
  if (n.includes('24') || n.includes('2year') || n.includes('twoyear')) return '24months';
  if (n === 'monthly' || n === 'month' || n.includes('12') || n.includes('year') || n.includes('annual')) return '12months';
  return null;
}

function getCheckoutMatrixBasePrice(paymentType: string, voluntaryExcess?: number, claimLimit?: number): number | null {
  const duration = normalizeCheckoutDuration(paymentType);
  if (!duration) return null;

  const allowedExcesses = [0, 50, 100, 150] as const;
  const normalizedExcess = allowedExcesses.includes(Number(voluntaryExcess) as 0 | 50 | 100 | 150)
    ? (Number(voluntaryExcess) as 0 | 50 | 100 | 150)
    : 100;

  // Columns are the cover levels: £1,000 / £2,000 / £3,000. Retired wire values
  // (750 = £1,000, 1250 = £2,000) still arrive on older records.
  const requestedClaimLimit = Number(claimLimit);
  let normalizedClaimLimit: 1000 | 2000 | 3000 = 2000;
  if (requestedClaimLimit === 750 || requestedClaimLimit === 1000) normalizedClaimLimit = 1000;
  else if (requestedClaimLimit >= 2000 && requestedClaimLimit !== 1250) normalizedClaimLimit = 3000;

  // Public checkout promo logic: 2yr/3yr £2,000+ cover uses the £2,000 column.
  if (duration !== '12months' && normalizedClaimLimit === 3000) {
    normalizedClaimLimit = 2000;
  }

  return CHECKOUT_BASE_PRICING_MATRIX[duration][normalizedExcess][normalizedClaimLimit] ?? null;
}

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
    case "two_yearly": return Number(plan.two_yearly_price ?? (Number(plan.yearly_price ?? 0) * 2));
    case "three_yearly": return Number(plan.three_yearly_price ?? (Number(plan.yearly_price ?? 0) * 3));
    case "yearly":
    default: return Number(plan.yearly_price ?? (Number(plan.monthly_price ?? 0) * 12));
  }
}

/**
 * Server-side check: is the client-submitted finalAmount within an acceptable
 * range vs. the recomputed plan price for the requested term?
 *
 * Returns { ok: false, reason } if the price looks manipulated and the
 * caller should reject the checkout request with HTTP 400.
 */
/**
 * Is this a genuine, currently usable discount code row? Used to gate the TEST
 * £1 bypass so a made-up "TEST..." string cannot lower the price floor.
 */
async function isLiveDiscountCode(supabase: SupabaseClient, code: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("valid_from, valid_to, usage_limit, used_count")
      .eq("code", code.trim().toUpperCase())
      .eq("active", true)
      .eq("archived", false)
      .maybeSingle();

    if (error || !data) return false;

    const now = Date.now();
    if (data.valid_from && now < new Date(data.valid_from).getTime()) return false;
    if (data.valid_to && now > new Date(data.valid_to).getTime()) return false;
    if (data.usage_limit && Number(data.used_count ?? 0) >= Number(data.usage_limit)) return false;

    return true;
  } catch (_e) {
    return false;
  }
}

export async function validateCheckoutPrice(

  input: PriceFloorInput,
  supabaseAdmin?: SupabaseClient,
): Promise<PriceFloorResult> {
  const { planId, paymentType, voluntaryExcess, claimLimit, finalAmount, discountCode } = input;

  const supabase = supabaseAdmin ?? createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // TEST bypass codes drop the floor to £1 for anyone who knows the code — but
  // ONLY if the code really exists in discount_codes, is active, not archived,
  // in date and within its usage limit. A guessed string like "TEST123" is not
  // enough: without that DB row the normal floors apply.
  const bypass = isTestBypassCode(discountCode)
    ? await isLiveDiscountCode(supabase, discountCode!)
    : false;
  const termFloor = getTermFloorGBP(paymentType, input.isMotorbike);
  // HARD £299 backstop (13 Sep 2026): no non-motorbike sale may complete below
  // £299 under any circumstances. Website motorbikes (half-price floor) are the
  // only exception. Genuine live TEST codes keep the £1 QA floor.
  const HARD_MIN_GBP = 299;
  const absoluteFloor = bypass
    ? TEST_MIN_GBP
    : input.isMotorbike === true
      ? termFloor
      : Math.max(termFloor, HARD_MIN_GBP);


  // 1. Absolute floor — fast reject
  if (!finalAmount || finalAmount < absoluteFloor) {
    return {
      ok: false,
      reason: `Submitted price £${finalAmount} is below the absolute minimum of £${absoluteFloor}. This indicates a manipulated request.`,
    };
  }


  // 2. Recompute plan-based floor from the live public pricing matrix first.
  // If a flow doesn't use that matrix, fall back to DB plan pricing below.
  const checkoutMatrixBasePrice = getCheckoutMatrixBasePrice(paymentType, voluntaryExcess, claimLimit);
  if (checkoutMatrixBasePrice && checkoutMatrixBasePrice > 0) {
    const minimumAllowed = bypass
      ? TEST_MIN_GBP
      : Math.max(termFloor, Math.floor(checkoutMatrixBasePrice * MIN_PERCENT_OF_BASE));

    if (finalAmount < minimumAllowed) {
      return {
        ok: false,
        reason: `Submitted price £${finalAmount} is below the minimum allowed £${minimumAllowed} ` +
                `(checkout base £${checkoutMatrixBasePrice}). Likely price manipulation.`,
        serverBasePrice: checkoutMatrixBasePrice,
        minimumAllowed,
      };
    }

    return { ok: true, bypass, serverBasePrice: checkoutMatrixBasePrice, minimumAllowed };
  }

  // 3. Recompute plan-based floor from DB (reuses supabase client created above)


  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
  const query = supabase.from("special_vehicle_plans").select("*");
  const { data: plan } = isUUID
    ? await query.eq("id", planId).maybeSingle()
    : await query.ilike("name", planId).maybeSingle();

  if (!plan) {
    return { ok: true, bypass, serverBasePrice: 0, minimumAllowed: absoluteFloor };
  }

  const serverBasePrice = getBasePriceFromPlan(plan, paymentType);
  if (!serverBasePrice || serverBasePrice <= 0) {
    return { ok: true, bypass, serverBasePrice: 0, minimumAllowed: absoluteFloor };
  }

  const minimumAllowed = bypass
    ? TEST_MIN_GBP
    : Math.max(termFloor, Math.floor(serverBasePrice * MIN_PERCENT_OF_BASE));

  if (finalAmount < minimumAllowed) {
    return {
      ok: false,
      reason: `Submitted price £${finalAmount} is below the minimum allowed £${minimumAllowed} ` +
              `(plan base £${serverBasePrice}). Likely price manipulation.`,
      serverBasePrice,
      minimumAllowed,
    };
  }

  return { ok: true, bypass, serverBasePrice, minimumAllowed };
}
