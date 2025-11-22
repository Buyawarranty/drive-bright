import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DISCOUNT-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const body = await req.json();
    const { code, type, value, valid_from, valid_to, usage_limit, active } = body;

    logStep("Creating discount code", { code, type, value });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Stripe coupon
    let stripeCoupon;
    try {
      const couponData: any = {
        duration: "once",
        name: `Discount Code: ${code}`,
      };

      if (type === 'percentage') {
        couponData.percent_off = value;
      } else {
        // Convert pounds to pence for Stripe
        couponData.amount_off = Math.round(value * 100);
        couponData.currency = 'gbp';
      }

      stripeCoupon = await stripe.coupons.create(couponData);
      logStep("Stripe coupon created", { couponId: stripeCoupon.id });
    } catch (stripeError) {
      logStep("Stripe coupon creation failed", { error: stripeError });
      throw new Error(`Failed to create Stripe coupon: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`);
    }

    // Create Stripe promotion code
    let stripePromoCode;
    try {
      stripePromoCode = await stripe.promotionCodes.create({
        coupon: stripeCoupon.id,
        code: code,
        active: active,
      });
      logStep("Stripe promotion code created", { promoCodeId: stripePromoCode.id });
    } catch (stripeError) {
      logStep("Stripe promotion code creation failed", { error: stripeError });
      // Clean up the coupon if promotion code creation failed
      await stripe.coupons.del(stripeCoupon.id);
      throw new Error(`Failed to create Stripe promotion code: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`);
    }

    // Insert into database
    const { data, error } = await supabaseClient
      .from('discount_codes')
      .insert({
        code,
        type,
        value,
        valid_from,
        valid_to,
        usage_limit,
        active,
        stripe_coupon_id: stripeCoupon.id,
        stripe_promo_code_id: stripePromoCode.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logStep("Database insert failed", { error });
      // Clean up Stripe resources
      await stripe.promotionCodes.update(stripePromoCode.id, { active: false });
      await stripe.coupons.del(stripeCoupon.id);
      throw error;
    }

    logStep("Discount code created successfully", { id: data.id });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-discount-code", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});