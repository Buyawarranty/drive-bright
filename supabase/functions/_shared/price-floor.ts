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
  discountCode?: string;      // Optional - test codes (TEST*) only bypass when a manager JWT is present
  authHeader?: string | null; // Optional - caller's Authorization header, used to gate TEST bypass to managers
}

// Test discount codes that bypass the £120 absolute floor and 50% plan floor.
// ONLY managers (admin, super_admin, sales_manager) can use these. Any code
// starting with "TEST" is also treated as a manager-gated test bypass.
const TEST_BYPASS_CODES = new Set<string>([
  "SAVE99GOLDEN",
]);

export function isTestBypassCode(code?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (!c) return false;
  return c.startsWith("TEST") || TEST_BYPASS_CODES.has(c);
}

// When a manager applies a TEST code, allow the transaction down to £1 (still
// above Stripe's £0.30 minimum) so QA can run realistic low-value flows.
const TEST_MIN_GBP = 1;

export interface PriceFloorResult {
  ok: boolean;
  bypass?: boolean;   // true when a manager applied a TEST bypass code
  reason?: string;
  serverBasePrice?: number;
  minimumAllowed?: number;
}

// Hard absolute floor — no warranty in the catalogue is anywhere near this low.
// Business rule: block every transaction under £120 (and definitely every £1
// attempt) across Stripe, Bumper, Payment Assist, and multi-warranty flows,
// UNLESS the caller is an authenticated manager applying a TEST bypass code.
export const ABSOLUTE_MIN_GBP = 120;

// Returns true if the caller's JWT belongs to an admin / super_admin /
// sales_manager. Used to gate TEST bypass codes so they can never be abused
// from a public checkout, even if someone knows the code string.
async function callerIsManager(
  authHeader: string | null | undefined,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) return false;
    const uid = userData.user.id;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const allowed = new Set(["admin", "super_admin", "sales_manager"]);
    return Array.isArray(roles) && roles.some((r: any) => allowed.has(r.role));
  } catch {
    return false;
  }
}


// Maximum legitimate discount stack (voluntary excess + promo + 10% pay-in-full)
// Anything below 50% of the recomputed plan price is treated as manipulation.
const MIN_PERCENT_OF_BASE = 0.5;

// Mirrors the live public checkout pricing matrix used by Step 3/Step 4.
// Keeping the validation source aligned with the public calculator prevents
// valid Stripe amounts from being rejected as "price manipulation".
const CHECKOUT_BASE_PRICING_MATRIX = {
  '12months': {
    0: { 750: 391, 1250: 416, 2000: 492 },
    50: { 750: 366, 1250: 383, 2000: 458 },
    100: { 750: 324, 1250: 349, 2000: 425 },
    150: { 750: 288, 1250: 324, 2000: 400 },
  },
  '24months': {
    0: { 750: 752, 1250: 786, 2000: 862 },
    50: { 750: 694, 1250: 736, 2000: 803 },
    100: { 750: 618, 1250: 660, 2000: 736 },
    150: { 750: 584, 1250: 618, 2000: 694 },
  },
  '36months': {
    0: { 750: 1130, 1250: 1172, 2000: 1256 },
    50: { 750: 1046, 1250: 1088, 2000: 1172 },
    100: { 750: 920, 1250: 988, 2000: 1072 },
    150: { 750: 878, 1250: 920, 2000: 1004 },
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

  const requestedClaimLimit = Number(claimLimit);
  let normalizedClaimLimit: 750 | 1250 | 2000 = requestedClaimLimit === 750 || requestedClaimLimit === 2000 ? requestedClaimLimit : 1250;

  // Public checkout promo logic: 2yr/3yr £2000 cover uses the £1250 price row.
  if (duration !== '12months' && normalizedClaimLimit === 2000) {
    normalizedClaimLimit = 1250;
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
export async function validateCheckoutPrice(
  input: PriceFloorInput,
  supabaseAdmin?: SupabaseClient,
): Promise<PriceFloorResult> {
  const { planId, paymentType, voluntaryExcess, claimLimit, finalAmount, discountCode, authHeader } = input;

  const supabase = supabaseAdmin ?? createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // TEST bypass codes ONLY apply when the caller is an authenticated manager.
  // A public checkout that includes "SAVE99GOLDEN" or "TEST123" cannot drop
  // below £120 because the JWT check fails.
  const codeLooksLikeBypass = isTestBypassCode(discountCode);
  const bypass = codeLooksLikeBypass && (await callerIsManager(authHeader, supabase));
  const absoluteFloor = bypass ? TEST_MIN_GBP : ABSOLUTE_MIN_GBP;

  // 1. Absolute floor — fast reject
  if (!finalAmount || finalAmount < absoluteFloor) {
    return {
      ok: false,
      reason: `Submitted price £${finalAmount} is below the absolute minimum of £${absoluteFloor}. ` +
              (codeLooksLikeBypass && !bypass
                ? `TEST bypass codes require a manager account.`
                : `This indicates a manipulated request.`),
    };
  }


  // 2. Recompute plan-based floor from the live public pricing matrix first.
  // If a flow doesn't use that matrix, fall back to DB plan pricing below.
  const checkoutMatrixBasePrice = getCheckoutMatrixBasePrice(paymentType, voluntaryExcess, claimLimit);
  if (checkoutMatrixBasePrice && checkoutMatrixBasePrice > 0) {
    const minimumAllowed = bypass
      ? TEST_MIN_GBP
      : Math.max(ABSOLUTE_MIN_GBP, Math.floor(checkoutMatrixBasePrice * MIN_PERCENT_OF_BASE));

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
    : Math.max(ABSOLUTE_MIN_GBP, Math.floor(serverBasePrice * MIN_PERCENT_OF_BASE));

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
