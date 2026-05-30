// One-off seed for the standard public promo bundle.
// Codes were renamed for clarity:
//   SAVE5/10/15/20  -> PERCENT5 / PERCENT10 / PERCENT15 / PERCENT20
//   SAVE50/75/100   -> 50POUNDSOFF / 75POUNDSOFF / 100POUNDSOFF
// Idempotent — safe to call repeatedly. Migrates old codes to the new names,
// deactivates the old Stripe promo codes, and creates the new Stripe promos.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Spec {
  code: string;
  legacyCode?: string;
  type: "percentage" | "fixed";
  value: number;
  min_order_amount?: number;
  description: string;
}

const SPECS: Spec[] = [
  { code: "PERCENT5",  legacyCode: "SAVE5",  type: "percentage", value: 5,  description: "5% off your warranty — cannot be combined with other offers" },
  { code: "PERCENT10", legacyCode: "SAVE10", type: "percentage", value: 10, description: "10% off your warranty — cannot be combined with other offers" },
  { code: "PERCENT15", legacyCode: "SAVE15", type: "percentage", value: 15, description: "15% off your warranty — cannot be combined with other offers" },
  { code: "PERCENT20", legacyCode: "SAVE20", type: "percentage", value: 20, description: "20% off your warranty — cannot be combined with other offers" },
  { code: "50POUNDSOFF",  legacyCode: "SAVE50",  type: "fixed", value: 50,  description: "£50 off your warranty — cannot be combined with other offers" },
  { code: "75POUNDSOFF",  legacyCode: "SAVE75",  type: "fixed", value: 75,  description: "£75 off your warranty — cannot be combined with other offers" },
  { code: "100POUNDSOFF", legacyCode: "SAVE100", type: "fixed", value: 100, min_order_amount: 450, description: "£100 off warranties of £450 or more — cannot be combined with other offers" },
];

const VALID_FROM = new Date("2025-01-01T00:00:00Z").toISOString();
const VALID_TO = new Date("2035-12-31T23:59:59Z").toISOString();
const USAGE_LIMIT = 10000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const results: any[] = [];

    for (const spec of SPECS) {
      // Look up existing row by new code, then by legacy code
      let { data: existing } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", spec.code)
        .maybeSingle();

      let migratedFrom: string | null = null;
      if (!existing && spec.legacyCode) {
        const { data: legacy } = await supabase
          .from("discount_codes")
          .select("*")
          .eq("code", spec.legacyCode)
          .maybeSingle();
        if (legacy) {
          existing = legacy;
          migratedFrom = spec.legacyCode;
          // Deactivate old Stripe promo code so it can no longer be redeemed
          if (legacy.stripe_promo_code_id) {
            try {
              await stripe.promotionCodes.update(legacy.stripe_promo_code_id, { active: false });
            } catch (e) {
              console.warn(`[seed] could not deactivate old Stripe promo ${legacy.stripe_promo_code_id}`, e);
            }
          }
        }
      }

      // Reuse coupon (just an amount/percent) but always mint a fresh promo code
      // for the new name, because Stripe promo code strings are immutable.
      let stripe_coupon_id = existing?.stripe_coupon_id ?? null;
      let stripe_promo_code_id = migratedFrom ? null : (existing?.stripe_promo_code_id ?? null);

      if (!stripe_coupon_id) {
        const couponData: any = {
          duration: "once",
          name: `Discount Code: ${spec.code}`,
        };
        if (spec.type === "percentage") {
          couponData.percent_off = spec.value;
        } else {
          couponData.amount_off = Math.round(spec.value * 100);
          couponData.currency = "gbp";
        }
        const coupon = await stripe.coupons.create(couponData);
        stripe_coupon_id = coupon.id;
      }

      if (!stripe_promo_code_id) {
        try {
          const promo = await stripe.promotionCodes.create({
            coupon: stripe_coupon_id,
            code: spec.code,
            active: true,
          });
          stripe_promo_code_id = promo.id;
        } catch (e) {
          const list = await stripe.promotionCodes.list({ code: spec.code, limit: 1 });
          if (list.data[0]) {
            stripe_promo_code_id = list.data[0].id;
          } else {
            throw e;
          }
        }
      }

      const row = {
        code: spec.code,
        type: spec.type,
        value: spec.value,
        valid_from: VALID_FROM,
        valid_to: VALID_TO,
        usage_limit: USAGE_LIMIT,
        active: true,
        archived: false,
        campaign_source: "SALESTEAM",
        is_public: true,
        public_description: spec.description,
        min_order_amount: spec.min_order_amount ?? 0,
        stripe_coupon_id,
        stripe_promo_code_id,
      };

      if (existing) {
        const { error } = await supabase
          .from("discount_codes")
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
        results.push({ code: spec.code, action: migratedFrom ? `renamed from ${migratedFrom}` : "updated" });
      } else {
        const { error } = await supabase
          .from("discount_codes")
          .insert(row);
        if (error) throw error;
        results.push({ code: spec.code, action: "created" });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[seed-promo-bundle] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
