import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const body = await req.json();
    const { 
      planName, 
      planId,
      paymentType, 
      voluntaryExcess = 0, 
      vehicleData, 
      customerData, 
      discountCode, 
      finalAmount, 
      protectionAddOns, 
      claimLimit,
      labourRate,
      seasonalBonusMonths,
      startDate,
      gclid,
      gaClientId
    } = body;
    
    logStep("Request data", { planName, planId, paymentType, voluntaryExcess, discountCode, finalAmount, protectionAddOns });

    // Validate vehicle age (must be 15 years or newer)
    const vehicleYear = vehicleData?.year;
    if (vehicleYear) {
      const currentYear = new Date().getFullYear();
      const yearInt = parseInt(vehicleYear);
      const vehicleAge = currentYear - yearInt;
      
      if (vehicleAge > 15) {
        logStep("Vehicle age validation failed", { vehicleYear, vehicleAge });
        return new Response(
          JSON.stringify({ error: `We cannot offer warranties for vehicles over 15 years old. This vehicle is ${vehicleAge} years old.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      logStep("Vehicle age validation passed", { vehicleYear, vehicleAge });
    }

    // Use planName for pricing lookup (basic, gold, platinum)
    const planType = planName?.toLowerCase() || planId?.toLowerCase() || 'basic';

    // Get authenticated user
    let user = null;
    let customerEmail = customerData?.email || vehicleData?.email || "guest@buyawarranty.co.uk";
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== "Bearer null") {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
        logStep("User authenticated", { userId: user?.id, userEmail: user?.email, formEmail: customerData?.email });
        if (!customerData?.email && !vehicleData?.email && user?.email) {
          customerEmail = user.email;
        }
      } catch (authError) {
        logStep("Auth failed, proceeding as guest", { error: authError });
      }
    } else {
      logStep("No auth header, proceeding as guest checkout");
    }

    logStep("Using customer email", { email: customerEmail, source: customerData?.email ? 'form' : (user?.email ? 'auth' : 'guest') });

    // Use final amount provided
    let totalAmount = finalAmount;
    
    if (!totalAmount) {
      logStep("ERROR: No finalAmount provided");
      return new Response(
        JSON.stringify({ error: "Final amount is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Using total amount", { totalAmount });
    
    // Convert to pence for Stripe
    const amount = Math.round(totalAmount * 100);

    logStep("Calculated amount", { totalAmount, amount, planType, paymentType, voluntaryExcess });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });
    
    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create a new customer
      const newCustomer = await stripe.customers.create({
        email: customerEmail,
        name: `${customerData?.first_name || ''} ${customerData?.last_name || ''}`.trim(),
        phone: customerData?.mobile || customerData?.phone || '',
        address: {
          line1: `${customerData?.building_number || ''} ${customerData?.street || ''}`.trim(),
          line2: customerData?.building_name || '',
          city: customerData?.town || '',
          state: customerData?.county || '',
          postal_code: customerData?.postcode || '',
          country: 'GB',
        }
      });
      customerId = newCustomer.id;
      logStep("New customer created", { customerId });
    }

    // Create PaymentIntent with all metadata needed for webhook processing
    // Payment methods: Use automatic_payment_methods to let Stripe show the best options
    // Apple Pay/Google Pay are handled via 'card' with wallet detection
    // Order preference is set in the PaymentElement on the frontend
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        // Plan details
        plan_id: planType,
        plan_type: planType,
        payment_type: paymentType,
        user_id: user?.id || '',
        
        // Customer details
        customer_name: `${customerData?.first_name || ''} ${customerData?.last_name || ''}`.trim() || customerData?.fullName || '',
        customer_phone: customerData?.mobile || customerData?.phone || '',
        customer_email: customerEmail,
        customer_first_name: customerData?.first_name || '',
        customer_last_name: customerData?.last_name || '',
        customer_street: customerData?.street || '',
        customer_town: customerData?.town || '',
        customer_county: customerData?.county || '',
        customer_postcode: customerData?.postcode || '',
        customer_country: customerData?.country || 'United Kingdom',
        customer_building_name: customerData?.building_name || '',
        customer_flat_number: customerData?.flat_number || '',
        customer_building_number: customerData?.building_number || '',
        customer_dob: customerData?.customer_dob || '',
        
        // Vehicle details
        vehicle_reg: vehicleData?.regNumber || customerData?.vehicle_reg || '',
        vehicle_make: vehicleData?.make || '',
        vehicle_model: vehicleData?.model || '',
        vehicle_year: vehicleData?.year || '',
        vehicle_fuel_type: vehicleData?.fuelType || '',
        vehicle_transmission: vehicleData?.transmission || '',
        vehicle_mileage: vehicleData?.mileage || '',
        vehicle_type: vehicleData?.vehicleType || 'standard',
        
        // Pricing details
        discount_code: discountCode || '',
        voluntary_excess: voluntaryExcess?.toString() ?? '0',
        final_amount: finalAmount?.toString() || totalAmount?.toString(),
        claim_limit: claimLimit?.toString() || '1250',
        labour_rate: labourRate?.toString() || '70',
        seasonal_bonus_months: seasonalBonusMonths?.toString() || '0',
        start_date: startDate || '',
        
        // Add-ons data
        addon_tyre_cover: protectionAddOns?.tyre ? 'true' : 'false',
        addon_wear_tear: protectionAddOns?.wearAndTear ? 'true' : 'false',
        addon_europe_cover: protectionAddOns?.european ? 'true' : 'false',
        addon_transfer_cover: protectionAddOns?.transfer ? 'true' : 'false',
        addon_breakdown_recovery: protectionAddOns?.breakdown ? 'true' : 'false',
        addon_vehicle_rental: protectionAddOns?.rental ? 'true' : 'false',
        addon_mot_fee: protectionAddOns?.motFee ? 'true' : 'false',
        addon_mot_repair: protectionAddOns?.motRepair ? 'true' : 'false',
        addon_lost_key: protectionAddOns?.lostKey ? 'true' : 'false',
        addon_consequential: protectionAddOns?.consequential ? 'true' : 'false',
        
        // Tracking data
        gclid: gclid || '',
        ga_client_id: gaClientId || '',
        
        // Flag to identify embedded checkout
        is_embedded_checkout: 'true'
      },
      description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Warranty Plan - ${vehicleData?.regNumber || 'Vehicle'}`
    });

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id, 
      clientSecret: paymentIntent.client_secret?.substring(0, 20) + '...',
      amount: paymentIntent.amount
    });

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Return amount in pounds for display
        customerId
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment-intent", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
