import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-CHECKOUT] ${timestamp} ${step}${detailsStr}`);
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
    const { planId, vehicleData, paymentType, voluntaryExcess = 0, customerData, discountCode, finalAmount, protectionAddOns, claimLimit, seasonalBonusMonths = 0 } = body;
    logStep("Request data", { planId, vehicleData, paymentType, voluntaryExcess, discountCode, finalAmount, protectionAddOns, claimLimit, seasonalBonusMonths });

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

    // Function to get default claim limit - user selection should override this
    function getMaxClaimAmount(planName: string, paymentType?: string): string {
      // Return default claim limit of 1250 - user selection should override this
      // Valid claim limits are 750, 1250, 2000
      return '1250';
    }

    // Helper function to get warranty duration in months
    function getWarrantyDurationInMonths(paymentType: string): number {
      const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
      
      switch (normalizedPaymentType) {
        case 'monthly':
        case '1month':
        case 'month':
        case '12months':
        case '12month':
        case 'yearly':
        case 'annual':
        case 'year':
          return 12;
        case '24months':
        case '24month':
        case 'twomonthly':
        case '2monthly':
        case 'twoyear':
        case 'twoyearly':
        case '2yearly':
        case '2years':
        case '2year':
          return 24;
        case '36months':
        case '36month':
        case 'threemonthly':
        case '3monthly':
        case 'threeyear':
        case 'threeyearly':
        case '3yearly':
        case '3years':
        case '3year':
          return 36;
        case '48months':
        case '48month':
        case 'fourmonthly':
        case '4monthly':
        case 'fouryearly':
        case '4yearly':
        case '4years':
        case '4year':
          return 48;
        case '60months':
        case '60month':
        case 'fivemonthly':
        case '5monthly':
        case 'fiveyearly':
        case '5yearly':
        case '5years':
        case '5year':
          return 60;
        default:
          console.warn(`Unknown payment type: ${paymentType}, defaulting to 12 months`);
          return 12;
      }
    }

    // Get plan data from database
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    logStep("Fetching plan data", { planId });
    
    // Check if planId is a UUID or a plan name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    
    let planData;
    let planError;
    
    if (isUUID) {
      const result = await supabaseService
        .from('special_vehicle_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();
      planData = result.data;
      planError = result.error;
    } else {
      // If not UUID, treat as plan name (case insensitive)
      const result = await supabaseService
        .from('special_vehicle_plans')
        .select('*')
        .ilike('name', planId)
        .maybeSingle();
      planData = result.data;
      planError = result.error;
    }
    
    if (planError) {
      logStep("Plan fetch error", { planId, error: planError });
      throw new Error(`Database error fetching plan: ${planError.message}`);
    }
    
    if (!planData) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const planType = planData.name.toLowerCase();
    logStep("Using plan type", { planId, planType });

    // Get authenticated user
    let user = null;
    // Prioritize email from customer form data over authenticated user email
    let customerEmail = customerData?.email || vehicleData?.email || "guest@buyawarranty.co.uk";
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== "Bearer null") {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
        logStep("User authenticated", { userId: user?.id, userEmail: user?.email, formEmail: customerData?.email });
        // Only use authenticated user email if no email provided in form
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

    // Calculate pricing based on payment type and voluntary excess
    let totalAmount = finalAmount;
    
    if (!totalAmount) {
      // Use plan pricing with voluntary excess calculation
      const basePrices = {
        monthly: planData.monthly_price,
        yearly: planData.yearly_price,
        twoYear: planData.two_yearly_price,
        threeYear: planData.three_yearly_price
      };

      const basePrice = basePrices[paymentType as keyof typeof basePrices] || planData.monthly_price;
      
      // Apply voluntary excess discount (5% off for every £50 excess)
      const discountPercent = Math.min(voluntaryExcess / 50 * 5, 25); // Cap at 25% discount
      totalAmount = basePrice * (1 - discountPercent / 100);
    }

    logStep("Calculated pricing", { totalAmount, paymentType, voluntaryExcess });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    const origin = req.headers.get("origin") || "https://pricing.buyawarranty.co.uk";
    
    // Check if customer exists in Stripe
    let stripeCustomerId = null;
    if (customerEmail !== "guest@buyawarranty.co.uk") {
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });
      
      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
        logStep("Found existing Stripe customer", { customerId: stripeCustomerId });
      }
    }

    // Create line items
    const lineItems = [{
      price_data: {
        currency: "gbp",
        product_data: { 
          name: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Warranty Plan - ${paymentType.replace(/([A-Z])/g, ' $1').trim()}`,
          description: `Vehicle Registration: ${vehicleData?.regNumber || customerData?.vehicle_reg || 'N/A'}`
        },
        unit_amount: Math.round(totalAmount * 100), // Convert to pence
      },
      quantity: 1,
    }];

    // Apply discount code if provided
    let coupon = null;
    if (discountCode) {
      try {
        const coupons = await stripe.coupons.list({ limit: 100 });
        coupon = coupons.data.find((c: any) => c.name === discountCode && c.valid);
        if (coupon) {
          logStep("Applied discount code", { discountCode, couponId: coupon.id });
        }
      } catch (couponError) {
        logStep("Failed to apply discount code", { discountCode, error: couponError });
      }
    }

    console.log("STRIPE DEBUG: Customer data:", { stripeCustomerId, customerEmail });
    
    // Create checkout session
    const sessionData: any = {
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/thank-you?plan=${planType}&payment=${paymentType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?step=4&restore=${encodeURIComponent(btoa(JSON.stringify({
        regNumber: vehicleData?.regNumber || customerData?.vehicle_reg || '',
        email: customerData?.email || '',
        phone: customerData?.phone || '',
        firstName: customerData?.first_name || '',
        lastName: customerData?.last_name || '',
        address: customerData?.address || '',
        make: vehicleData?.make || '',
        model: vehicleData?.model || '',
        year: vehicleData?.year || '',
        vehicleType: vehicleData?.vehicleType || '',
        mileage: vehicleData?.mileage || '',
        step: 4,
        selectedPlan: {
          id: planType,
          paymentType: paymentType,
          name: planData.name,
          pricingData: {
            totalPrice: finalAmount,
            monthlyPrice: paymentType === 'monthly' ? finalAmount : 0,
            voluntaryExcess: voluntaryExcess
          }
        }
      })))}`,
      metadata: {
        plan_type: planType,
        payment_type: paymentType,
        vehicle_reg: vehicleData?.regNumber || customerData?.vehicle_reg || '',
        // Vehicle data
        vehicle_make: vehicleData?.make || '',
        vehicle_model: vehicleData?.model || '',
        vehicle_year: vehicleData?.year || '',
        vehicle_mileage: vehicleData?.mileage || '',
        vehicle_fuel_type: vehicleData?.fuelType || '',
        vehicle_transmission: vehicleData?.transmission || '',
        vehicle_type: vehicleData?.vehicleType || 'standard',
        voluntary_excess: voluntaryExcess.toString(),
        customer_email: customerEmail,
        original_amount: totalAmount.toString(),
        claim_limit: claimLimit?.toString() || getMaxClaimAmount(planData.name, paymentType),
        seasonal_bonus_months: seasonalBonusMonths.toString(),
        // Add-ons data - using correct field names that match handle-successful-payment
        addon_tyre_cover: protectionAddOns?.tyre ? 'true' : 'false',
        addon_wear_tear: protectionAddOns?.wearAndTear ? 'true' : 'false', // Fixed key: wearAndTear not wearTear
        addon_europe_cover: protectionAddOns?.european ? 'true' : 'false',
        addon_transfer_cover: protectionAddOns?.transfer ? 'true' : 'false',
        addon_breakdown_recovery: protectionAddOns?.breakdown ? 'true' : 'false',
        addon_vehicle_rental: protectionAddOns?.rental ? 'true' : 'false',
        addon_mot_fee: protectionAddOns?.motFee ? 'true' : 'false',
        addon_mot_repair: protectionAddOns?.motRepair ? 'true' : 'false',
        addon_lost_key: protectionAddOns?.lostKey ? 'true' : 'false',
        addon_consequential: protectionAddOns?.consequential ? 'true' : 'false'
      }
    };

    // Add customer or customer_email but not both
    if (stripeCustomerId) {
      sessionData.customer = stripeCustomerId;
      console.log("STRIPE DEBUG: Using customer ID:", stripeCustomerId);
    } else if (customerEmail) {
      sessionData.customer_email = customerEmail;
      console.log("STRIPE DEBUG: Using customer email:", customerEmail);
    }

    if (coupon) {
      sessionData.discounts = [{ coupon: coupon.id }];
    }

    // Add customer data to metadata if available
      if (customerData) {
        sessionData.metadata = {
          ...sessionData.metadata,
          customer_name: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim(),
          customer_first_name: customerData.first_name || '',
          customer_last_name: customerData.last_name || '',
          customer_phone: customerData.phone || customerData.mobile || '',
          customer_address: `${customerData.address_line_1 || ''}, ${customerData.address_line_2 || ''}, ${customerData.city || ''}, ${customerData.postcode || ''}`.trim().replace(/,+/g, ',').replace(/^,|,$/g, ''),
          // Individual address components for W2000
          customer_street: customerData.address_line_1 || '',
          customer_town: customerData.city || '',
          customer_county: customerData.county || '',
          customer_postcode: customerData.postcode || '',
          customer_country: customerData.country || 'United Kingdom',
          customer_building_name: customerData.building_name || '',
          customer_flat_number: customerData.flat_number || '',
          customer_building_number: customerData.building_number || ''
        };
      }

    const session = await stripe.checkout.sessions.create(sessionData);
    
    logStep("Stripe checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      amount: totalAmount,
      paymentType
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      source: 'stripe'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-stripe-checkout", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});