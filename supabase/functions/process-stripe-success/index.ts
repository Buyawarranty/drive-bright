import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-STRIPE-SUCCESS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - method: " + req.method);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let requestBody;
    try {
      const bodyText = await req.text();
      logStep("Raw request body", { bodyText });
      requestBody = JSON.parse(bodyText);
      logStep("Parsed request body", requestBody);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      logStep("Error parsing request body", { error: errorMessage });
      throw new Error(`Invalid JSON in request body: ${errorMessage}`);
    }

    const { sessionId } = requestBody;
    logStep("Extracted parameters", { sessionId });

    if (!sessionId) {
      throw new Error("Missing sessionId parameter");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Retrieve the checkout session with expanded customer data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer']
    });

    logStep("Retrieved Stripe session", { 
      sessionId: session.id,
      customerEmail: session.customer_email,
      metadata: session.metadata 
    });

    if (!session || session.payment_status !== 'paid') {
      throw new Error("Payment not completed or session not found");
    }

    // Get plan and payment type from session metadata
    const planId = session.metadata?.plan_type || session.metadata?.plan_id || '';
    const paymentType = session.metadata?.payment_type || '';
    
    logStep("Extracted from session metadata", { planId, paymentType });
    
    if (!planId || !paymentType) {
      throw new Error("Missing plan or payment type in session metadata");
    }

    // Extract customer and vehicle data from session metadata
    const vehicleData = {
      regNumber: session.metadata?.vehicle_reg || '',
      mileage: session.metadata?.vehicle_mileage || '',
      make: session.metadata?.vehicle_make || '',
      model: session.metadata?.vehicle_model || '',
      year: session.metadata?.vehicle_year || '',
      fuelType: session.metadata?.vehicle_fuel_type || '',
      transmission: session.metadata?.vehicle_transmission || '',
      vehicleType: session.metadata?.vehicle_type || 'standard',
      voluntaryExcess: parseInt(session.metadata?.voluntary_excess || '0'),
      fullName: session.metadata?.customer_name || '',
      phone: session.metadata?.customer_phone || '',
      address: `${session.metadata?.customer_street || ''} ${session.metadata?.customer_town || ''} ${session.metadata?.customer_county || ''} ${session.metadata?.customer_postcode || ''}`.trim(),
      email: session.customer_email || session.customer_details?.email || session.metadata?.customer_email || ''
    };

    const customerData = {
      first_name: session.metadata?.customer_first_name || '',
      last_name: session.metadata?.customer_last_name || '',
      mobile: session.metadata?.customer_phone || '',
      street: session.metadata?.customer_street || '',
      town: session.metadata?.customer_town || '',
      county: session.metadata?.customer_county || '',
      postcode: session.metadata?.customer_postcode || '',
      country: session.metadata?.customer_country || 'United Kingdom',
      building_name: session.metadata?.customer_building_name || '',
      flat_number: session.metadata?.customer_flat_number || '',
      building_number: session.metadata?.customer_building_number || '',
      vehicle_reg: session.metadata?.vehicle_reg || '',
      discount_code: session.metadata?.discount_code || '',
      final_amount: parseFloat(session.metadata?.final_amount || '0'),
      fullName: session.metadata?.customer_name || '',
      phone: session.metadata?.customer_phone || '',
      address: `${session.metadata?.customer_street || ''}, ${session.metadata?.customer_town || ''}, ${session.metadata?.customer_county || ''}, ${session.metadata?.customer_postcode || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim()
    };

    logStep("Extracted vehicle and customer data", { vehicleData, customerData });

    // CRITICAL: DO NOT create warranty here - the webhook already handled it!
    // Just retrieve the existing warranty that was created by the Stripe webhook
    logStep("Looking up existing warranty created by webhook");
    
    // Query for existing customer and policy using the Stripe session ID
    const { data: existingCustomer, error: customerError } = await supabaseClient
      .from('customers')
      .select(`
        id,
        email,
        warranty_number,
        customer_policies (
          id,
          warranty_number,
          policy_start_date,
          policy_end_date
        )
      `)
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (customerError) {
      logStep("Error querying existing customer", customerError);
      // Don't throw - webhook might still be processing
    }

    let paymentData: any = {
      message: 'Payment verified successfully',
      customerEmail: vehicleData.email
    };

    if (existingCustomer && existingCustomer.customer_policies && existingCustomer.customer_policies.length > 0) {
      // Warranty was already created by webhook
      const policy = existingCustomer.customer_policies[0];
      paymentData = {
        ...paymentData,
        policyNumber: policy.warranty_number || existingCustomer.warranty_number,
        customerId: existingCustomer.id,
        policyId: policy.id,
        policyStartDate: policy.policy_start_date,
        policyEndDate: policy.policy_end_date,
        source: 'webhook_already_processed'
      };
      
      logStep("Found existing warranty from webhook", { 
        policyNumber: paymentData.policyNumber,
        customerId: existingCustomer.id 
      });
    } else {
      // Webhook might still be processing - that's okay
      logStep("Warranty not found yet - webhook may still be processing", {
        sessionId,
        customerEmail: vehicleData.email
      });
      
      paymentData = {
        ...paymentData,
        message: 'Payment verified - warranty will be created shortly by webhook',
        source: 'webhook_pending'
      };
    }

    return new Response(JSON.stringify({
      success: true, 
      message: "Payment processed and warranty registered successfully",
      policyNumber: paymentData?.policyNumber,
      data: paymentData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-stripe-success", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});