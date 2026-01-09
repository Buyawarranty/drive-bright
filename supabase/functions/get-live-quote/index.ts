import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-LIVE-QUOTE] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { accessToken } = body;

    logStep("Request data", { accessToken: accessToken?.substring(0, 8) + '...' });

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the quote
    const { data: quote, error: quoteError } = await supabaseClient
      .from('live_quotes')
      .select('*')
      .eq('access_token', accessToken)
      .single();

    if (quoteError || !quote) {
      logStep("Quote not found", { error: quoteError });
      return new Response(
        JSON.stringify({ error: "Quote not found", notFound: true }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if quote has expired
    const isExpired = new Date(quote.expires_at) < new Date();

    // Update viewed_at if first view
    if (!quote.viewed_at && !isExpired && quote.status !== 'paid') {
      await supabaseClient
        .from('live_quotes')
        .update({ 
          viewed_at: new Date().toISOString(),
          status: 'viewed'
        })
        .eq('id', quote.id);
    }

    logStep("Quote found", { quoteId: quote.id, status: quote.status, isExpired });

    // Return quote data (exclude sensitive fields)
    return new Response(
      JSON.stringify({
        success: true,
        quote: {
          id: quote.id,
          customerName: quote.customer_name,
          customerEmail: quote.customer_email,
          vehicle: {
            reg: quote.vehicle_reg,
            make: quote.vehicle_make,
            model: quote.vehicle_model,
            year: quote.vehicle_year,
            mileage: quote.vehicle_mileage,
            fuelType: quote.vehicle_fuel_type,
            transmission: quote.vehicle_transmission
          },
          cover: {
            planType: quote.plan_type,
            durationMonths: quote.duration_months,
            bonusMonths: quote.bonus_months,
            excessAmount: quote.excess_amount,
            claimLimit: quote.claim_limit,
            labourRate: quote.labour_rate,
            boostAddon: quote.boost_addon,
            breakdownIncluded: quote.breakdown_included,
            rentalIncluded: quote.rental_included
          },
          pricing: {
            monthlyPrice: quote.monthly_price,
            upfrontPrice: quote.upfront_price,
            currency: quote.currency
          },
          additionalNotes: quote.additional_notes,
          status: quote.status,
          isExpired,
          isPaid: quote.status === 'paid',
          policyNumber: quote.policy_number,
          createdByName: quote.created_by_name,
          createdAt: quote.created_at,
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
