import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-DISCOUNT-CODE] ${step}${detailsStr}`);
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

    const { code, customerEmail, orderAmount, vehicleReg } = await req.json();
    if (!code) throw new Error("Discount code is required");

    logStep("Validating discount code", { code, customerEmail, orderAmount });

    // Auto-expire codes before validation
    logStep("Auto-expiring codes before validation");
    await supabaseClient.rpc('auto_expire_discount_codes');

    // TEST bypass codes (TEST* and SAVE99GOLDEN) can only be validated by an
    // authenticated manager. This prevents anyone from typing a QA code on the
    // public checkout and receiving a large discount.
    const codeUpper = (code || "").toUpperCase();
    const isTestCode = codeUpper.startsWith("TEST") || codeUpper === "SAVE99GOLDEN";
    if (isTestCode) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const managerRoles = new Set(["admin", "super_admin", "sales_manager"]);
      let allowed = false;
      let uid: string | undefined;
      if (token) {
        const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
        uid = userData?.user?.id;
        if (userErr) logStep("TEST code: token lookup failed", { message: userErr.message });
        if (uid) {
          // Managers can live in user_roles and/or admin_users — accept either.
          const [{ data: roles }, { data: adminRow }] = await Promise.all([
            supabaseClient.from("user_roles").select("role").eq("user_id", uid),
            supabaseClient
              .from("admin_users")
              .select("role, is_active")
              .eq("user_id", uid)
              .maybeSingle(),
          ]);
          const hasUserRole = Array.isArray(roles) && roles.some((r: any) => managerRoles.has(r.role));
          const hasAdminRole = !!adminRow && adminRow.is_active !== false && managerRoles.has(adminRow.role);
          allowed = hasUserRole || hasAdminRole;
          logStep("TEST code role check", { uid, hasUserRole, hasAdminRole });
        }
      }
      if (!allowed) {
        logStep("TEST bypass code blocked for non-manager", { code, hasToken: !!token, uid });
        return new Response(JSON.stringify({
          valid: false,
          error: token
            ? "This test code is restricted to managers. Sign in with a manager account to use it."
            : "This test code only works while signed in as a manager on the same browser.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }


    // Get the discount code details (including archived status)
    const { data: discountCode, error: fetchError } = await supabaseClient
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('active', true)
      .eq('archived', false)
      .single();

    if (fetchError || !discountCode) {
      logStep("Discount code not found or inactive", { code });
      return new Response(JSON.stringify({
        valid: false,
        error: "Invalid or inactive discount code"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const now = new Date();
    const validFrom = new Date(discountCode.valid_from);
    const validTo = new Date(discountCode.valid_to);

    // Check date validity
    if (now < validFrom || now > validTo) {
      logStep("Discount code expired or not yet valid", { code, validFrom, validTo, now });
      return new Response(JSON.stringify({
        valid: false,
        error: "Discount code has expired or is not yet valid"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check usage limit
    if (discountCode.usage_limit && discountCode.used_count >= discountCode.usage_limit) {
      logStep("Discount code usage limit exceeded", { code, usedCount: discountCode.used_count, limit: discountCode.usage_limit });
      return new Response(JSON.stringify({
        valid: false,
        error: "Discount code usage limit has been reached"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if customer has already used this code (by email)
    if (customerEmail) {
      const { data: existingUsage } = await supabaseClient
        .from('discount_code_usage')
        .select('id')
        .eq('discount_code_id', discountCode.id)
        .eq('customer_email', customerEmail)
        .single();

      if (existingUsage) {
        logStep("Customer has already used this discount code", { code, customerEmail });
        return new Response(JSON.stringify({
          valid: false,
          error: "You have already used this discount code"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Check if vehicle has already used this code (by vehicle reg)
    if (vehicleReg) {
      const { data: existingVehicleUsage } = await supabaseClient
        .from('discount_code_usage')
        .select('id')
        .eq('discount_code_id', discountCode.id)
        .eq('vehicle_reg', vehicleReg.toUpperCase())
        .single();

      if (existingVehicleUsage) {
        logStep("Vehicle has already used this discount code", { code, vehicleReg });
        return new Response(JSON.stringify({
          valid: false,
          error: "This discount code has already been used for this vehicle"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Check minimum spend (configured per-code via min_order_amount, defaults to 0 = no minimum)
    const minOrderAmount = Number(discountCode.min_order_amount ?? 0);
    if (minOrderAmount > 0 && orderAmount && orderAmount < minOrderAmount) {
      logStep("Order amount below minimum spend for code", { code, orderAmount, minOrderAmount });
      return new Response(JSON.stringify({
        valid: false,
        error: `Minimum order of £${minOrderAmount} required to use this code. Your current order is £${orderAmount}.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate discount amount with minimum price floor.
    // IMPORTANT: mirrors the server-side checkout price floor (ABSOLUTE_MIN_GBP = £120)
    // in supabase/functions/_shared/price-floor.ts. TEST codes reach this point only
    // when the caller is a manager (gated above), so they get the £1 QA floor.
    const MINIMUM_FINAL_AMOUNT = isTestCode ? 1 : 120;

    let discountAmount = 0;
    if (discountCode.type === 'percentage') {
      discountAmount = (orderAmount * discountCode.value) / 100;
    } else {
      discountAmount = Math.min(discountCode.value, orderAmount);
    }
    
    // Cap discount so final amount is at least MINIMUM_FINAL_AMOUNT (Stripe-safe and floor-safe)
    const maxAllowedDiscount = Math.max(0, orderAmount - MINIMUM_FINAL_AMOUNT);
    const effectiveDiscountAmount = Math.min(discountAmount, maxAllowedDiscount);
    const finalAmount = Math.max(MINIMUM_FINAL_AMOUNT, orderAmount - effectiveDiscountAmount);

    logStep("Discount code validated successfully", {
      code,
      originalDiscountAmount: discountAmount,
      effectiveDiscountAmount,
      type: discountCode.type,
      value: discountCode.value,
      finalAmount
    });

    return new Response(JSON.stringify({
      valid: true,
      discountCode: {
        id: discountCode.id,
        code: discountCode.code,
        type: discountCode.type,
        value: discountCode.value,
        stripe_coupon_id: discountCode.stripe_coupon_id,
        stripe_promo_code_id: discountCode.stripe_promo_code_id
      },
      discountAmount: effectiveDiscountAmount,
      finalAmount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in validate-discount-code", { message: errorMessage });
    return new Response(JSON.stringify({ 
      valid: false, 
      error: "Failed to validate discount code" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});