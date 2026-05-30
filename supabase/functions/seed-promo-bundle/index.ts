// One-off seed for the standard public promo bundle (SAVE5/10/15/20 + SAVE50/75/100).
// Idempotent — safe to call repeatedly. Updates existing rows to keep them aligned
// with the canonical settings (public, unlimited-ish, no end date, non-stackable note).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Spec {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_order_amount?: number;
  description: string;
}

const SPECS: Spec[] = [
  { code: "SAVE5", type: "percentage", value: 5, description: "5% off your warranty — cannot be combined with other offers" },
  { code: "SAVE10", type: "percentage", value: 10, description: "10% off your warranty — cannot be combined with other offers" },
  { code: "SAVE15", type: "percentage", value: 15, description: "15% off your warranty — cannot be combined with other offers" },
  { code: "SAVE20", type: "percentage", value: 20, description: "20% off your warranty — cannot be combined with other offers" },
  { code: "SAVE50", type: "fixed", value: 50, description: "£50 off your warranty — cannot be combined with other offers" },
  { code: "SAVE75", type: "fixed", value: 75, description: "£75 off your warranty — cannot be combined with other offers" },
  { code: "SAVE100", type: "fixed", value: 100, min_order_amount: 450, description: "£100 off warranties of £450 or more — cannot be combined with other offers" },
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
      // Look up existing row
      const { data: existing } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", spec.code)
        .maybeSingle();

      let stripe_coupon_id = existing?.stripe_coupon_id ?? null;
      let stripe_promo_code_id = existing?.stripe_promo_code_id ?? null;

      // Create Stripe coupon if missing
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

      // Create Stripe promo code if missing
      if (!stripe_promo_code_id) {
        try {
          const promo = await stripe.promotionCodes.create({
            coupon: stripe_coupon_id,
            code: spec.code,
            active: true,
          });
          stripe_promo_code_id = promo.id;
        } catch (e) {
          // If a promo code with this name already exists in Stripe, fetch it
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
        results.push({ code: spec.code, action: "updated" });
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
