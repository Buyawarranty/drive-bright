
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { planName, paymentType, voluntaryExcess = 0, vehicleData, customerData, discountCode, finalAmount, addAnotherWarrantyRequested, protectionAddOns, claimLimit } = body;
    logStep("Request data", { planName, paymentType, voluntaryExcess, discountCode, finalAmount, protectionAddOns });

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
    function getMaxClaimAmount(planName: string): string {
      // Return default claim limit of 1250 - user selection should override this
      // Valid claim limits are 750, 1250, 2000
      return '1250';
    }
    
    // Use planName for pricing lookup (basic, gold, platinum)
    const planType = planName?.toLowerCase() || 'basic';

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

    // Use final amount if provided, otherwise calculate from pricing table
    let totalAmount = finalAmount;
    
    if (!totalAmount) {
      // Fallback to pricing calculation if finalAmount not provided
      const pricingTable = {
        yearly: {
          0: { basic: 372, gold: 408, platinum: 437 },
          50: { basic: 348, gold: 372, platinum: 384 },
          100: { basic: 300, gold: 324, platinum: 348 },
          150: { basic: 276, gold: 312, platinum: 324 },
          200: { basic: 240, gold: 276, platinum: 300 }
        },
        two_yearly: {
          0: { basic: 670, gold: 734, platinum: 786 },
          50: { basic: 626, gold: 670, platinum: 691 },
          100: { basic: 540, gold: 583, platinum: 626 },
          150: { basic: 497, gold: 562, platinum: 583 },
          200: { basic: 456, gold: 528, platinum: 552 }
        },
        three_yearly: {
          0: { basic: 982, gold: 1077, platinum: 1153 },
          50: { basic: 919, gold: 982, platinum: 1014 },
          100: { basic: 792, gold: 855, platinum: 919 },
          150: { basic: 729, gold: 824, platinum: 855 },
          200: { basic: 672, gold: 792, platinum: 828 }
        }
      };

      // Get pricing data
      const periodData = pricingTable[paymentType as keyof typeof pricingTable] || pricingTable.yearly;
      const excessData = periodData[voluntaryExcess as keyof typeof periodData] || periodData[0];
      const baseAmount = excessData[planType as keyof typeof excessData] || excessData.basic;
      
      // Apply 5% discount for upfront Stripe payments (already applied in frontend)
      totalAmount = baseAmount;
    }

    logStep("Using total amount", { totalAmount, source: finalAmount ? 'provided' : 'calculated' });
    
    // Convert to pence for Stripe
    const amount = totalAmount * 100;

    logStep("Calculated amount", { totalAmount, amount, planType, paymentType, voluntaryExcess });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://pricing.buyawarranty.co.uk";
    
    // Prepare session creation options
    const sessionOptions: any = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { 
              name: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Warranty Plan`,
              description: `Vehicle warranty coverage - Full payment with 5% discount${discountCode ? ` + discount code applied` : ''}`
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/thank-you?plan=${planType}&payment=${paymentType}&session_id={CHECKOUT_SESSION_ID}&addAnotherWarranty=${addAnotherWarrantyRequested || false}`,
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
          name: planName,
          pricingData: {
            totalPrice: finalAmount,
            monthlyPrice: paymentType === 'monthly' ? finalAmount : 0,
            voluntaryExcess: voluntaryExcess
          }
        }
      })))}`,
      metadata: {
        plan_id: planType,
        payment_type: paymentType,
        user_id: user?.id || '',
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
        vehicle_reg: vehicleData?.regNumber || customerData?.vehicle_reg || '',
        vehicle_make: vehicleData?.make || '',
        vehicle_model: vehicleData?.model || '',
        vehicle_year: vehicleData?.year || '',
        vehicle_fuel_type: vehicleData?.fuelType || '',
        vehicle_transmission: vehicleData?.transmission || '',
        vehicle_mileage: vehicleData?.mileage || '',
        vehicle_type: vehicleData?.vehicleType || 'standard',
        discount_code: discountCode || '',
        voluntary_excess: voluntaryExcess?.toString() ?? '0',
        final_amount: finalAmount?.toString() || totalAmount?.toString(),
        claim_limit: claimLimit?.toString() || getMaxClaimAmount(planName),
        // Add-ons data - using correct field names that match handle-successful-payment
        addon_tyre_cover: protectionAddOns?.tyre ? 'true' : 'false',
        addon_wear_tear: protectionAddOns?.wearAndTear ? 'true' : 'false',
        addon_europe_cover: protectionAddOns?.european ? 'true' : 'false',
        addon_transfer_cover: protectionAddOns?.transfer ? 'true' : 'false',
        addon_breakdown_recovery: protectionAddOns?.breakdown ? 'true' : 'false',
        addon_vehicle_rental: protectionAddOns?.rental ? 'true' : 'false',
        addon_mot_fee: protectionAddOns?.motFee ? 'true' : 'false',
        addon_mot_repair: protectionAddOns?.motRepair ? 'true' : 'false',
        addon_lost_key: protectionAddOns?.lostKey ? 'true' : 'false',
        addon_consequential: protectionAddOns?.consequential ? 'true' : 'false'
      },
      automatic_tax: { enabled: false },
      billing_address_collection: 'required',
      customer_creation: customerId ? undefined : 'always',
    };

    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
