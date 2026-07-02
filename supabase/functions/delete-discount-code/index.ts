import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, corsHeaders } from "../_shared/admin-auth.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-DISCOUNT-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Require an authenticated admin caller
    const auth = await requireAdmin(req, { allowedRoles: ["admin", "super_admin", "sales_manager", "performance_manager"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Admin authenticated", { userId: user.id });

    const { id } = await req.json();
    if (!id) throw new Error("Discount code ID is required");

    // Get the discount code details first
    const { data: discountCode, error: fetchError } = await supabaseClient
      .from('discount_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!discountCode) throw new Error("Discount code not found");

    logStep("Found discount code", { code: discountCode.code });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Deactivate Stripe promotion code if it exists
    if (discountCode.stripe_promo_code_id) {
      try {
        await stripe.promotionCodes.update(discountCode.stripe_promo_code_id, {
          active: false
        });
        logStep("Stripe promotion code deactivated", { promoCodeId: discountCode.stripe_promo_code_id });
      } catch (stripeError) {
        logStep("Warning: Failed to deactivate Stripe promotion code", { error: stripeError });
        // Continue with deletion even if Stripe operation fails
      }
    }

    // Delete Stripe coupon if it exists
    if (discountCode.stripe_coupon_id) {
      try {
        await stripe.coupons.del(discountCode.stripe_coupon_id);
        logStep("Stripe coupon deleted", { couponId: discountCode.stripe_coupon_id });
      } catch (stripeError) {
        logStep("Warning: Failed to delete Stripe coupon", { error: stripeError });
        // Continue with deletion even if Stripe operation fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseClient
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    logStep("Discount code deleted successfully", { id });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in delete-discount-code", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});