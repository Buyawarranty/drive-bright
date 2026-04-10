import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-LIVE-QUOTE] ${timestamp} ${step}${detailsStr}`);
};

// Generate a secure access token
function generateAccessToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get authorization header for admin verification
    const authHeader = req.headers.get("Authorization");
    
    // Authorization is required
    if (!authHeader) {
      logStep("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Auth failed", { error: authError, tokenPrefix: token.substring(0, 20) });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is an admin - use maybeSingle to avoid PGRST116 crash
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('id, email, first_name, last_name, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      logStep("Admin lookup error", { error: adminError, userId: user.id });
      return new Response(
        JSON.stringify({ error: "Admin lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminUser) {
      // Fallback: check by email
      logStep("No admin by user_id, trying email fallback", { userId: user.id, email: user.email });
      const { data: adminByEmail } = await supabaseClient
        .from('admin_users')
        .select('id, email, first_name, last_name, is_active, user_id')
        .eq('email', user.email)
        .maybeSingle();

      if (adminByEmail?.is_active) {
        // Fix the user_id mapping for future calls
        await supabaseClient
          .from('admin_users')
          .update({ user_id: user.id })
          .eq('id', adminByEmail.id);
        logStep("Admin found by email, updated user_id mapping", { adminEmail: adminByEmail.email });
      } else {
        logStep("Not an admin user", { userId: user.id, email: user.email });
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!adminUser.is_active) {
      logStep("Admin user inactive", { adminEmail: adminUser.email });
      return new Response(
        JSON.stringify({ error: "Admin account is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      logStep("Admin verified", { adminEmail: adminUser.email });
    }

    const body = await req.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicleData,
      paymentType,
      excessAmount,
      claimLimit,
      labourRate,
      boostAddon,
      monthlyPrice,
      upfrontPrice,
      breakdownIncluded,
      rentalIncluded,
      additionalNotes,
      freeExtendedCover,
      createdByName,
      customerDob
    } = body;

    logStep("Request data", { customerEmail, vehicleData: vehicleData?.regNumber, paymentType, claimLimit, boostAddon, labourRate, freeExtendedCover });

    // Validate required fields
    if (!customerName || !customerEmail || !vehicleData?.regNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: customerName, customerEmail, vehicleData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate duration months from payment type
    const durationMap: Record<string, number> = {
      '12months': 12,
      '24months': 24,
      '36months': 36
    };
    const durationMonths = durationMap[paymentType] || 12;
    
    // Calculate bonus months based on freeExtendedCover selection
    const bonusMonthsMap: Record<string, number> = {
      'none': 0,
      '3months': 3,
      '6months': 6
    };
    const bonusMonths = bonusMonthsMap[freeExtendedCover] || 0;

    // Generate access token
    const accessToken = generateAccessToken();

    // Create the live quote
    const { data: quote, error: insertError } = await supabaseClient
      .from('live_quotes')
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        vehicle_reg: vehicleData.regNumber,
        vehicle_make: vehicleData.make || null,
        vehicle_model: vehicleData.model || null,
        vehicle_year: vehicleData.year || null,
        vehicle_mileage: vehicleData.mileage || null,
        vehicle_fuel_type: vehicleData.fuelType || null,
        vehicle_transmission: vehicleData.transmission || null,
        vehicle_type: vehicleData.vehicleType || null,
        plan_type: 'Platinum',
        duration_months: durationMonths,
        bonus_months: bonusMonths,
        excess_amount: excessAmount || 100,
        claim_limit: claimLimit || 1250,
        labour_rate: labourRate || 70,
        boost_addon: boostAddon || false,
        monthly_price: monthlyPrice,
        upfront_price: upfrontPrice,
        currency: 'GBP',
        breakdown_included: breakdownIncluded || false,
        rental_included: rentalIncluded || false,
        additional_notes: additionalNotes || null,
        access_token: accessToken,
        status: 'sent',
        created_by_name: createdByName || null,
        share_link: `https://buyawarranty.co.uk/quote/${accessToken}`,
        customer_dob: customerDob || null
      })
      .select()
      .single();

    if (insertError) {
      logStep("Insert error", { error: insertError });
      return new Response(
        JSON.stringify({ error: "Failed to create quote", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Quote created", { quoteId: quote.id, accessToken });

    return new Response(
      JSON.stringify({
        success: true,
        quote: {
          id: quote.id,
          accessToken: quote.access_token,
          shareLink: quote.share_link,
          expiresAt: quote.expires_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logStep("Unexpected error", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
