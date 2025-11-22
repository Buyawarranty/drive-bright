import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-EXPIRE-DISCOUNT-CODES] ${step}${detailsStr}`);
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

    // Call the database function to auto-expire codes
    const { data, error } = await supabaseClient.rpc('auto_expire_discount_codes');

    if (error) {
      logStep("Error auto-expiring codes", { error: error.message });
      throw error;
    }

    const expiredCount = data as number;
    logStep("Auto-expire completed", { expiredCount });

    return new Response(JSON.stringify({
      success: true,
      expiredCount,
      message: `${expiredCount} discount codes have been auto-archived`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in auto-expire-discount-codes", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Failed to auto-expire discount codes",
      details: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});