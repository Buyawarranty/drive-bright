// One-off setup function: creates the SAVE50 promo code in Stripe + DB.
// Idempotent — safe to call multiple times. Returns existing code if present.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODE = "SAVE50";
const VALUE_GBP = 50; // £50 off
const VALID_DAYS = 365; // long-lived; popup enforces 15-min urgency client-side

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if it already exists
    const { data: existing } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("code", CODE)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "SAVE50 already exists", data: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Stripe coupon
    const coupon = await stripe.coupons.create({
      duration: "once",
      name: `Discount Code: ${CODE}`,
      amount_off: VALUE_GBP * 100,
      currency: "gbp",
    });

    // Create promo code
    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: CODE,
      active: true,
    });

    const validFrom = new Date();
    const validTo = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("discount_codes")
      .insert({
        code: CODE,
        type: "fixed",
        value: VALUE_GBP,
        valid_from: validFrom.toISOString(),
        valid_to: validTo.toISOString(),
        usage_limit: null, // unlimited total uses; per-email/vehicle uniqueness enforced server-side
        active: true,
        stripe_coupon_id: coupon.id,
        stripe_promo_code_id: promo.id,
      })
      .select()
      .single();

    if (error) {
      // Cleanup Stripe if DB failed
      await stripe.promotionCodes.update(promo.id, { active: false });
      await stripe.coupons.del(coupon.id);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: "SAVE50 created", data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[seed-save50-promo] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
