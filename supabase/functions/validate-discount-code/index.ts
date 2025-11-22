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

    const { code, customerEmail, orderAmount } = await req.json();
    if (!code) throw new Error("Discount code is required");

    logStep("Validating discount code", { code, customerEmail, orderAmount });

    // Auto-expire codes before validation
    logStep("Auto-expiring codes before validation");
    await supabaseClient.rpc('auto_expire_discount_codes');

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

    // Check if customer has already used this code (if email provided)
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

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.type === 'percentage') {
      discountAmount = (orderAmount * discountCode.value) / 100;
    } else {
      discountAmount = Math.min(discountCode.value, orderAmount);
    }

    logStep("Discount code validated successfully", {
      code,
      discountAmount,
      type: discountCode.type,
      value: discountCode.value
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
      discountAmount,
      finalAmount: orderAmount - discountAmount
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