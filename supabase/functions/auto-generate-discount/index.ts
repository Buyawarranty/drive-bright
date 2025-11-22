import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-GENERATE-DISCOUNT] ${step}${detailsStr}`);
};

const generateRandomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let firstPart = '';
  let secondPart = '';
  
  // Generate first 3 characters
  for (let i = 0; i < 3; i++) {
    firstPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Generate second 3 characters
  for (let i = 0; i < 3; i++) {
    secondPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${firstPart}-${secondPart}`;
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

    const { customerEmail, orderAmount } = await req.json();
    if (!customerEmail) throw new Error("Customer email is required");

    logStep("Auto-generating discount code", { customerEmail, orderAmount });

    // Check for existing campaign code (any status)
    const campaignCode = "EMAIL25SAVE";
    const { data: existingCampaignCode } = await supabaseClient
      .from('discount_codes')
      .select('*')
      .eq('code', campaignCode)
      .single();

    let discountCodeData;
    const validFrom = new Date();
    const validTo = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years - indefinite

    if (existingCampaignCode) {
      logStep("Updating existing campaign code", { code: campaignCode });
      
      // Update the existing code with correct values and extend expiry
      const { data: updatedCode, error: updateError } = await supabaseClient
        .from('discount_codes')
        .update({
          type: 'fixed',
          value: 25,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          active: true,
          archived: false,
          usage_limit: null,
          applicable_products: ["all"]
        })
        .eq('id', existingCampaignCode.id)
        .select()
        .single();

      if (updateError) {
        logStep("Error updating campaign code", { error: updateError });
        throw new Error("Failed to update campaign discount code");
      }
      
      discountCodeData = updatedCode;
    } else {
      logStep("Creating new campaign code", { code: campaignCode });
      
      // Create the campaign discount code with longer expiry and unlimited use
      const { data: newDiscountCode, error: createError } = await supabaseClient
        .from('discount_codes')
        .insert({
          code: campaignCode,
          type: 'fixed',
          value: 25,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          usage_limit: null, // Unlimited uses
          used_count: 0,
          active: true,
          applicable_products: ["all"]
        })
        .select()
        .single();

      if (createError) {
        logStep("Error creating campaign discount code", { error: createError });
        throw new Error("Failed to create campaign discount code");
      }

      discountCodeData = newDiscountCode;
    }

    // Calculate discount amount (fixed £25)
    const discountAmount = 25;
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    logStep("Campaign discount code ready", {
      code: discountCodeData.code,
      discountAmount,
      finalAmount,
      validTo: discountCodeData.valid_to
    });

    return new Response(JSON.stringify({
      success: true,
      discountCode: {
        id: discountCodeData.id,
        code: discountCodeData.code,
        type: discountCodeData.type,
        value: discountCodeData.value
      },
      discountAmount,
      finalAmount,
      expiresAt: discountCodeData.valid_to
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in auto-generate-discount", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Failed to generate discount code" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});