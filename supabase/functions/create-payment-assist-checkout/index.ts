import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("[CREATE-PAYMENT-ASSIST-CHECKOUT] Function loaded and starting...");

const logStep = (step: string, details?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[CREATE-PAYMENT-ASSIST-CHECKOUT] ${timestamp} ${step}${detailsStr}`);
  } catch (e) {
    console.log(`[CREATE-PAYMENT-ASSIST-CHECKOUT] ${new Date().toISOString()} ${step} - [JSON stringify failed]`);
  }
};

// Generate HMAC-SHA256 signature for Payment Assist API
async function generateSignature(params: Record<string, string>, secretKey: string): Promise<string> {
  // Sort keys alphabetically (before uppercasing as per docs)
  const sortedKeys = Object.keys(params).sort();
  
  // Build the signature string with UPPER_CASE keys
  let signatureString = '';
  for (const key of sortedKeys) {
    const upperKey = key.toUpperCase();
    // Skip api_key and signature from the signature generation
    if (upperKey !== 'API_KEY' && upperKey !== 'SIGNATURE') {
      const value = params[key] ?? '';
      signatureString += `${upperKey}=${value}&`;
    }
  }
  
  logStep("Signature string (pre-hash)", { signatureString });
  
  // Generate HMAC-SHA256 hash
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const data = encoder.encode(signatureString);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  // Convert to hex string
  const signatureArray = new Uint8Array(signature);
  const hexArray = hexEncode(signatureArray);
  return new TextDecoder().decode(hexArray);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const requestData = await req.json();
    logStep("Request data", {
      planId: requestData.planId,
      vehicleData: requestData.vehicleData,
      originalPaymentType: requestData.paymentType,
      voluntaryExcess: requestData.voluntaryExcess,
      discountCode: requestData.discountCode,
      finalAmount: requestData.finalAmount,
      protectionAddOns: requestData.protectionAddOns
    });

    const {
      planId,
      vehicleData,
      paymentType: originalPaymentType,
      voluntaryExcess,
      customerData,
      discountCode,
      finalAmount,
      addAnotherWarrantyRequested,
      protectionAddOns = {},
      claimLimit = 1250,
      seasonalBonusMonths = 0,
      labourRate = 70,
      startDate = null,
      trackingData = {}
    } = requestData;

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

    // Payment Assist uses monthly installments similar to Bumper
    const paymentAssistPaymentType = "monthly";
    const instalmentCount = "12";
    const warrantyDuration = originalPaymentType;

    logStep("Using monthly payment for Payment Assist", {
      originalWarrantyDuration: originalPaymentType,
      paymentAssistPaymentType,
      instalmentCount
    });

    // Fetch plan data
    logStep("Fetching plan data", { planId });
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    
    let planData;
    let planError;
    
    if (isUUID) {
      const result = await supabase
        .from('special_vehicle_plans')
        .select('*')
        .eq('id', planId)
        .single();
      planData = result.data;
      planError = result.error;
    } else {
      const result = await supabase
        .from('special_vehicle_plans')
        .select('*')
        .ilike('name', planId)
        .single();
      planData = result.data;
      planError = result.error;
    }

    if (planError || !planData) {
      throw new Error(`Failed to fetch plan: ${planError?.message}`);
    }

    const planTypeMapping: Record<string, string> = {
      'Basic Van Plan': 'basic_van_plan',
      'Premium Van Plan': 'premium_van_plan',
      'Comprehensive Van Plan': 'comprehensive_van_plan',
      'Basic Car Plan': 'basic_car_plan',
      'Premium Car Plan': 'premium_car_plan',
      'Comprehensive Car Plan': 'comprehensive_car_plan',
    };

    const planType = planTypeMapping[planData.name] || 'basic';
    logStep("Using plan type", { planId, planType });

    const totalAmount = finalAmount || 500;
    const monthlyAmount = Math.floor(totalAmount / 12);

    logStep("Calculated amounts for Payment Assist", { totalAmount, monthlyAmount });

    // Create transaction ID for tracking
    const transactionId = `PA-${planType.toUpperCase()}-${Date.now()}`;
    
    const origin = req.headers.get("origin") || "https://8037b426-cb66-497b-bb9a-14209b3fb079.lovableproject.com";
    const redirectUrl = `${origin}/thank-you`;
    
    logStep("Creating Payment Assist transaction", { transactionId, redirectUrl });
    
    // Store transaction in a dedicated table (reusing bumper_transactions structure for now)
    const transactionInsertData = {
      transaction_id: transactionId,
      plan_id: planData.id,
      payment_type: originalPaymentType,
      customer_data: {
        ...customerData,
        original_warranty_duration: warrantyDuration,
        start_date: startDate || customerData?.start_date || null,
        vehicle_reg: customerData?.vehicle_reg || vehicleData?.regNumber || vehicleData?.registration,
        vehicle_make: customerData?.vehicle_make || vehicleData?.make,
        vehicle_model: customerData?.vehicle_model || vehicleData?.model,
        vehicle_year: customerData?.vehicle_year || vehicleData?.year,
        vehicle_fuel_type: customerData?.vehicle_fuel_type || vehicleData?.fuelType,
        vehicle_transmission: customerData?.vehicle_transmission || vehicleData?.transmission,
        vehicle_mileage: customerData?.vehicle_mileage || vehicleData?.mileage,
        // Flag to identify this as Payment Assist transaction
        payment_provider: 'payment_assist'
      },
      vehicle_data: {
        ...vehicleData,
        regNumber: vehicleData?.regNumber || vehicleData?.registration || customerData?.vehicle_reg,
        make: vehicleData?.make || customerData?.vehicle_make,
        model: vehicleData?.model || customerData?.vehicle_model,
        year: vehicleData?.year || customerData?.vehicle_year,
        fuelType: vehicleData?.fuelType || customerData?.vehicle_fuel_type,
        transmission: vehicleData?.transmission || customerData?.vehicle_transmission,
        mileage: vehicleData?.mileage || customerData?.vehicle_mileage
      },
      protection_addons: {
        ...protectionAddOns,
        voluntaryExcess: voluntaryExcess,
        seasonalBonusMonths: seasonalBonusMonths,
        labourRate: labourRate
      },
      final_amount: totalAmount,
      discount_code: discountCode || '',
      add_another_warranty: addAnotherWarrantyRequested || false,
      redirect_url: redirectUrl,
      status: 'pending',
      claim_limit: claimLimit,
      gclid: trackingData?.gclid || null,
      client_id: trackingData?.clientId || null,
      conversion_status: 'pending'
    };
    
    logStep("Transaction data to insert", { 
      transactionId,
      planId,
      totalAmount,
      customerEmail: customerData?.email
    });

    // Store in bumper_transactions table (reusing existing structure)
    const { data: insertedTransaction, error: storeError } = await supabase
      .from('bumper_transactions')
      .insert(transactionInsertData)
      .select()
      .single();

    if (storeError) {
      logStep("Failed to store transaction data", { error: storeError, transactionId });
      throw new Error(`Failed to store transaction data: ${storeError.message}`);
    }

    logStep("Transaction data stored successfully", { 
      transactionId, 
      insertedId: insertedTransaction.id,
      redirectUrl 
    });
    
    // Payment Assist API integration
    const paymentAssistApiKey = Deno.env.get("PAYMENT_ASSIST_API_KEY");
    const paymentAssistSecretKey = Deno.env.get("PAYMENT_ASSIST_SECRET_KEY");
    
    if (!paymentAssistApiKey || !paymentAssistSecretKey) {
      logStep("Missing Payment Assist API credentials");
      throw new Error("Payment Assist API credentials are not configured");
    }
    
    // Success URL - handled by our success handler edge function
    const successUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-payment-assist-success?tx=${transactionId}`;
    const failureUrl = `${origin}/payment-assist-test?error=payment_failed&tx=${transactionId}`;
    
    logStep("Calling Payment Assist API", { 
      transactionId,
      totalAmount,
      successUrl,
      customerEmail: customerData?.email
    });
    
    // Prepare customer address
    const addressLine1 = customerData?.address_line_1 || customerData?.building_number || '';
    const postcode = customerData?.postcode || '';
    
    // Build request parameters for Payment Assist API (flat structure as per docs)
    // All params must be strings for signature generation
    // Note: plan_id removed - let Payment Assist use default or configure in dashboard
    const requestParams: Record<string, string> = {
      order_id: transactionId,
      amount: String(Math.round(totalAmount * 100)), // Convert to pence
      f_name: customerData?.first_name || '',
      s_name: customerData?.last_name || '',
      addr1: addressLine1,
      postcode: postcode,
      email: customerData?.email || '',
      telephone: customerData?.phone || '',
      success_url: successUrl,
      failure_url: failureUrl,
      reg_no: vehicleData?.regNumber || vehicleData?.registration || ''
    };
    
    logStep("Payment Assist request params (before signature)", requestParams);
    
    try {
      // Generate HMAC-SHA256 signature
      const signature = await generateSignature(requestParams, paymentAssistSecretKey);
      logStep("Generated signature", { signature });
      
      // Add api_key and signature to the request
      const fullPayload = {
        ...requestParams,
        api_key: paymentAssistApiKey,
        signature: signature
      };
      
      logStep("Full Payment Assist payload", { 
        ...fullPayload,
        api_key: "[REDACTED]",
        signature: signature.substring(0, 20) + "..."
      });
      
      // Call Payment Assist API /begin endpoint
      const paymentAssistResponse = await fetch("https://api.v1.payment-assist.co.uk/begin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(fullPayload)
      });
      
      const responseText = await paymentAssistResponse.text();
      logStep("Payment Assist raw response", { 
        status: paymentAssistResponse.status, 
        statusText: paymentAssistResponse.statusText,
        responseText: responseText.substring(0, 500)
      });
      
      if (!paymentAssistResponse.ok) {
        logStep("Payment Assist API error", { 
          status: paymentAssistResponse.status, 
          response: responseText 
        });
        throw new Error(`Payment Assist API error: ${paymentAssistResponse.status} - ${responseText}`);
      }
      
      let paymentAssistData;
      try {
        paymentAssistData = JSON.parse(responseText);
      } catch (parseError) {
        logStep("Failed to parse Payment Assist response", { responseText });
        throw new Error("Invalid response from Payment Assist API");
      }
      
      // Payment Assist /begin returns { status, msg, data: { token, url } }
      const responseData = paymentAssistData.data || paymentAssistData;
      const checkoutUrl = responseData.url;
      const token = responseData.token;
      
      logStep("Payment Assist checkout created", { 
        token,
        url: checkoutUrl,
        transactionId
      });
      
      if (!checkoutUrl) {
        logStep("No checkout URL in Payment Assist response", paymentAssistData);
        throw new Error("Payment Assist did not return a checkout URL");
      }

      return new Response(
        JSON.stringify({ 
          url: checkoutUrl,
          transactionId,
          token,
          success: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      
    } catch (apiError) {
      const apiErrorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
      logStep("Payment Assist API call failed", { error: apiErrorMessage });
      throw new Error(`Payment Assist checkout failed: ${apiErrorMessage}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("Error in create-payment-assist-checkout", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
