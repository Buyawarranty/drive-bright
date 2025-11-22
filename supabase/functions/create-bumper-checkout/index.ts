import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Immediate logging to verify function is loading
console.log("[CREATE-BUMPER-CHECKOUT] Function loaded and starting...");

const logStep = (step: string, details?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[CREATE-BUMPER-CHECKOUT] ${timestamp} ${step}${detailsStr}`);
  } catch (e) {
    console.log(`[CREATE-BUMPER-CHECKOUT] ${new Date().toISOString()} ${step} - [JSON stringify failed]`);
  }
};

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
      seasonalBonusMonths = 0
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

    // Force payment to monthly for Bumper (they handle installments internally)
    // But preserve the original warranty duration for add-on calculations and W2000
    const bumperPaymentType = "monthly";
    const instalmentCount = "12"; // Default to 12 installments for Bumper
    
    // Keep original warranty duration for proper add-on logic and W2000 registration
    const warrantyDuration = originalPaymentType;

    logStep("Forcing monthly payment for Bumper", {
      originalWarrantyDuration: originalPaymentType,
      bumperPaymentType: bumperPaymentType,
      instalmentCount
    });

    // Fetch plan data to get plan type
    // Handle both UUID and plan name (for backward compatibility)
    logStep("Fetching plan data", { planId });
    
    // Check if planId is a UUID or a plan name
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
      // If not UUID, treat as plan name (case insensitive)
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

    // Map plan to Bumper plan type
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

    // Use the provided finalAmount as the total amount for Bumper
    const totalAmount = finalAmount || 500; // Fallback amount
    const monthlyAmount = totalAmount; // For Bumper, this is the total amount spread over installments

    logStep("Using total amount for Bumper", { totalAmount, monthlyAmount, source: finalAmount ? "provided" : "fallback" });

    const bumperApiKey = Deno.env.get("BUMPER_API_KEY");
    const bumperSecretKey = Deno.env.get("BUMPER_SECRET_KEY");

    logStep("Checking Bumper credentials", {
      hasApiKey: !!bumperApiKey,
      hasSecretKey: !!bumperSecretKey,
      apiKeyLength: bumperApiKey?.length,
      secretKeyLength: bumperSecretKey?.length
    });

    if (!bumperApiKey || !bumperSecretKey) {
      throw new Error("Bumper API credentials not configured");
    }

    // For Bumper, we'll send total amount but use pay later option for monthly installments
    const origin = req.headers.get("origin") || "https://8037b426-cb66-497b-bb9a-14209b3fb079.lovableproject.com";
    
    logStep("Creating Bumper checkout - TOTAL AMOUNT for entire cover period", {
      totalAmount,
      monthlyAmount,
      customerEmail: customerData?.email,
      origin,
      originalWarrantyDuration: originalPaymentType,
      bumperPaymentType: bumperPaymentType
    });

    // Create transaction ID for tracking
    const transactionId = `VW-${planType.toUpperCase()}-${Date.now()}`;
    
    // Store transaction data in database for later processing
    const redirectUrl = `${origin}/thank-you`;
    
    logStep("Attempting to store transaction data", { transactionId, redirectUrl });
    
    const transactionInsertData = {
      transaction_id: transactionId,
      plan_id: planData.id, // Use the actual UUID from the fetched plan data
      payment_type: originalPaymentType, // Store original warranty duration, not Bumper payment frequency
      customer_data: {
        ...customerData,
        // Store the original warranty duration for later processing
        original_warranty_duration: warrantyDuration,
        // Ensure vehicle registration is available in customer data
        vehicle_reg: customerData?.vehicle_reg || vehicleData?.regNumber || vehicleData?.registration,
        vehicle_make: customerData?.vehicle_make || vehicleData?.make,
        vehicle_model: customerData?.vehicle_model || vehicleData?.model,
        vehicle_year: customerData?.vehicle_year || vehicleData?.year,
        vehicle_fuel_type: customerData?.vehicle_fuel_type || vehicleData?.fuelType,
        vehicle_transmission: customerData?.vehicle_transmission || vehicleData?.transmission,
        vehicle_mileage: customerData?.vehicle_mileage || vehicleData?.mileage
      },
      vehicle_data: {
        ...vehicleData,
        // Ensure consistent field names
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
        voluntaryExcess: voluntaryExcess, // Store user's selection
        seasonalBonusMonths: seasonalBonusMonths // Store seasonal bonus
      },
      final_amount: totalAmount,
      discount_code: discountCode || '',
      add_another_warranty: addAnotherWarrantyRequested || false,
      redirect_url: redirectUrl,
      status: 'pending',
      claim_limit: claimLimit
    };
    
    logStep("Transaction data to insert", { 
      transactionId,
      planId,
      totalAmount,
      customerEmail: customerData?.email,
      hasVehicleData: !!vehicleData,
      hasCustomerData: !!customerData
    });

    const { data: insertedTransaction, error: storeError } = await supabase
      .from('bumper_transactions')
      .insert(transactionInsertData)
      .select()
      .single();

    if (storeError) {
      logStep("Failed to store transaction data", { error: storeError, transactionId });
      throw new Error(`Failed to store transaction data: ${storeError.message}`);
    }

    if (!insertedTransaction) {
      logStep("Transaction insert returned no data", { transactionId });
      throw new Error("Transaction insert returned no data");
    }

    logStep("Transaction data stored successfully", { 
      transactionId, 
      insertedId: insertedTransaction.id,
      redirectUrl 
    });
    
    // Bumper API URLs
    const bumperApiUrl = "https://api.bumper.co/v2/apply/";
    
    // Create URLs for success and failure
    const baseSuccessUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-bumper-success`;
    const baseFailureUrl = `${origin}/payment-fallback`;
    
    // Use the same simple URLs for both signature and request
    const successUrl = `${baseSuccessUrl}?tx=${transactionId}`;
    const failureUrl = `${baseFailureUrl}?tx=${transactionId}`;

    // Create payload for signature generation (with simple URLs)
    const signaturePayload = {
      amount: totalAmount.toString(),
      success_url: successUrl,
      failure_url: failureUrl,
      currency: "GBP",
      order_reference: transactionId,
      first_name: customerData.first_name || "",
      last_name: customerData.last_name || "",
      email: customerData.email || "",
      mobile: customerData.phone || customerData.mobile || "",
      vehicle_reg: customerData.vehicle_reg || vehicleData.regNumber || "",
      flat_number: customerData.flat_number || "",
      building_name: customerData.building_name || "",
      building_number: customerData.building_number || "",
      street: customerData.address_line_1 || customerData.street || "",
      town: customerData.city || customerData.town || "",
      county: customerData.county || "",
      postcode: customerData.postcode || "",
      country: customerData.country || "UK", // Default to UK as per Bumper example
      product_id: "4", // Use product_id for signature generation (Bumper's legacy field)
      send_sms: false, // Required by Bumper API
      send_email: false // Required by Bumper API
    };

    // Create payload for actual HTTP request (same simple URLs)
    const bumperRequestData = {
      amount: totalAmount.toString(),
      preferred_product_type: "paylater",
      api_key: bumperApiKey,
      success_url: successUrl,
      failure_url: failureUrl,
      currency: "GBP",
      order_reference: transactionId,
      first_name: customerData.first_name || "",
      last_name: customerData.last_name || "",
      email: customerData.email || "",
      mobile: customerData.phone || customerData.mobile || "",
      vehicle_reg: customerData.vehicle_reg || vehicleData.regNumber || "",
      // Address fields directly (not nested in object) with proper defaults
      flat_number: customerData.flat_number || "",
      building_name: customerData.building_name || "",
      building_number: customerData.building_number || "",
      street: customerData.address_line_1 || customerData.street || "",
      town: customerData.city || customerData.town || "",
      county: customerData.county || "",
      postcode: customerData.postcode || "",
      country: customerData.country || "UK", // Default to UK as per Bumper requirements
      product_id: "4", // Use product_id instead of instalments for API request
      send_sms: false, // Required by Bumper API
      send_email: false, // Required by Bumper API
      // product_description should be an array of objects as per Bumper documentation
      product_description: [{
        item: `${planType} Vehicle Warranty`,
        quantity: "1",
        price: totalAmount.toString()
      }]
    };

    // Remove sensitive data from logs
    const loggableData = { ...bumperRequestData };
    if ('api_key' in loggableData) delete (loggableData as any).api_key;
    if ('signature' in loggableData) delete (loggableData as any).signature;
    logStep("Bumper payload prepared", loggableData);

    // Generate signature using the corrected Bumper specification
    console.log("BUMPER DEBUG: Signature payload (for generation):", JSON.stringify(signaturePayload, null, 2));
    
    // DETAILED SIGNATURE DEBUG - Show step by step what we're doing
    console.log("=== DETAILED SIGNATURE GENERATION DEBUG ===");
    console.log("1. Original payload keys:", Object.keys(signaturePayload));
    console.log("2. Secret key being used:", bumperSecretKey);
    console.log("3. Secret key length:", bumperSecretKey?.length);
    
    // Generate the signature using the corrected algorithm
    console.log("🔐 GENERATING SIGNATURE using corrected Bumper specification");
    
    const signature = await generateSignature(signaturePayload, bumperSecretKey);
    
    // Add signature and api_key to the request payload
    (bumperRequestData as any).signature = signature;
    (bumperRequestData as any).api_key = bumperApiKey;
    
    console.log("✅ Generated signature:", signature);
    console.log("5. Final signature method used:", "bumper_specification_corrected");
    console.log("6. Final payload being sent to Bumper:", JSON.stringify({
      ...bumperRequestData,
      api_key: "[REDACTED]",
      signature: signature
    }, null, 2));
    
    // Try to reproduce the test case signature to verify our algorithm
    console.log("=== VERIFYING ALGORITHM WITH TEST CASE ===");
    const bumperTestPayload = {
      amount: "300.00",
      success_url: "http://www.supplier.com/success/",
      failure_url: "http://www.supplier.com/failure/",
      currency: "GBP",
      order_reference: "26352",
      first_name: "John",
      last_name: "Smith", 
      email: "john@smith.com",
      product_id: "4",
      mobile: "0778879989",
      vehicle_reg: "XYZ1234",
      flat_number: "23",
      building_name: "ABC Building",
      building_number: "39",
      street: "DEF way",
      town: "Southampton",
      county: "Hampshire",
      postcode: "SO14 3AB",
      country: "UK",
      send_sms: false,
      send_email: false
    };
    
    const bumperTestSecretKey = "9f*u/[`tt*.*k725X;u&Zkz";
    const bumperTestSignature = await generateSignature(bumperTestPayload, bumperTestSecretKey);
    const expectedSignature = "8be9b278125a4fa15c2af43f28307d2af90ec4c1e8f52c096b0652a1b66d49c7";
    
    console.log("Test signature generated:", bumperTestSignature);
    console.log("Expected test signature:", expectedSignature);
    console.log("Test signatures match:", bumperTestSignature === expectedSignature);
    
    if (bumperTestSignature !== expectedSignature) {
      console.log("❌ SIGNATURE ALGORITHM IS INCORRECT - Need to fix the generation logic");
      
      // Let's debug the test signature string step by step
      const testSigString = await debugSignatureString(bumperTestPayload);
      console.log("Test signature string:", testSigString);
      console.log("Test signature string length:", testSigString.length);
      
      // Check each character of the expected vs actual
      console.log("Character-by-character comparison of signature strings:");
      const expectedSigString = "AMOUNT=300.00&BUILDING_NAME=ABC Building&BUILDING_NUMBER=39&COUNTRY=UK&COUNTY=Hampshire&CURRENCY=GBP&EMAIL=john@smith.com&FAILURE_URL=http://www.supplier.com/failure/&FIRST_NAME=John&FLAT_NUMBER=23&LAST_NAME=Smith&MOBILE=0778879989&ORDER_REFERENCE=26352&POSTCODE=SO14 3AB&PRODUCT_ID=4&SEND_EMAIL=False&SEND_SMS=False&STREET=DEF way&SUCCESS_URL=http://www.supplier.com/success/&TOWN=Southampton&VEHICLE_REG=XYZ1234&";
      
      if (testSigString !== expectedSigString) {
        console.log("🔍 Signature strings don't match:");
        console.log("Expected:", expectedSigString);
        console.log("Actual  :", testSigString);
        console.log("Expected length:", expectedSigString.length);
        console.log("Actual length  :", testSigString.length);
      } else {
        console.log("✅ Signature strings match - issue is in HMAC generation");
      }
    } else {
      console.log("✅ SIGNATURE ALGORITHM IS CORRECT");
    }

    logStep("Making Bumper API request to PRODUCTION", { 
      url: bumperApiUrl,
      totalAmount,
      monthlyAmount
    });

    // Make request to Bumper API
    const bumperResponse = await fetch(bumperApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bumperRequestData),
    });

    logStep("Bumper API response received", {
      status: bumperResponse.status,
      statusText: bumperResponse.statusText,
      ok: bumperResponse.ok
    });

    const responseText = await bumperResponse.text();
    console.log("Raw Bumper API response:", responseText);

    let bumperData;
    try {
      bumperData = JSON.parse(responseText);
      console.log("Bumper API response data:", bumperData);
      logStep("Bumper API response", { status: bumperResponse.status, data: bumperData });
    } catch (parseError) {
      console.log("Failed to parse Bumper API response as JSON:", parseError);
      
      logStep("Bumper API returned invalid JSON", { 
        status: bumperResponse.status,
        responseText: responseText.substring(0, 500) // Limit log size
      });
      
      // Let Bumper handle their own response format
      throw new Error(`Bumper API returned invalid response: ${responseText.substring(0, 100)}`);
    }

    if (!bumperResponse.ok) {
      logStep("Bumper API error", { 
        status: bumperResponse.status,
        error: bumperData,
        statusText: bumperResponse.statusText
      });
      
      // Let Bumper handle their own error response
      throw new Error(`Bumper API error: ${bumperResponse.status} - ${bumperData?.message || 'Unknown error'}`);
    }

    if (bumperData?.data?.redirect_url) {
      logStep("Bumper application created successfully", { redirect_url: bumperData.data.redirect_url, token: bumperData.token });
      
      return new Response(JSON.stringify({ 
        url: bumperData.data.redirect_url,
        token: bumperData.token,
        source: 'bumper'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      throw new Error("No redirect URL received from Bumper");
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-bumper-checkout", { message: errorMessage });
    
    // Return error to frontend to handle appropriately
    return new Response(JSON.stringify({ 
      error: true,
      message: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Generate signature for Bumper API according to their exact documentation
async function generateSignature(payload: any, secretKey: string): Promise<string> {
  logStep('🔐 Starting signature generation with Bumper specification', { 
    payloadKeys: Object.keys(payload),
    secretKeyLength: secretKey.length 
  });
  
  // Create a copy and remove excluded fields as per Bumper docs:
  // "except for api_key, signature, product_description, preferred_product_type, and additional_data parameters"
  const filteredPayload = { ...payload };
  delete filteredPayload.api_key;
  delete filteredPayload.signature;
  delete filteredPayload.product_description;
  delete filteredPayload.preferred_product_type;
  delete filteredPayload.additional_data;
  
  logStep('🔍 Filtered payload (excluded signature fields)', { 
    filteredKeys: Object.keys(filteredPayload),
    excludedFields: ['api_key', 'signature', 'product_description', 'preferred_product_type', 'additional_data']
  });
  
  // Sort keys alphabetically as per Bumper specification
  const sortedKeys = Object.keys(filteredPayload).sort();
  logStep('📋 Sorted keys alphabetically', sortedKeys);
  
  // Build signature string exactly as per Bumper specification:
  // Format: "{PARAMETER}={value}&" where PARAMETER is upper-cased
  let signatureString = '';
  
  for (const key of sortedKeys) {
    const value = filteredPayload[key];
    
    // Handle boolean values - Bumper expects "True"/"False" (capitalized)
    let stringValue: string;
    if (typeof value === 'boolean') {
      stringValue = value ? 'True' : 'False';
    } else if (value === null || value === undefined) {
      stringValue = '';
    } else {
      stringValue = String(value);
    }
    
    // Parameter key should be upper-cased, value as-is
    // Format: "{PARAMETER}={value}&"
    signatureString += `${key.toUpperCase()}=${stringValue}&`;
  }
  
  logStep('📝 Final signature string for HMAC', { 
    signatureString,
    length: signatureString.length 
  });
  
  // Generate HMAC SHA-256 exactly as Bumper expects
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(signatureString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  logStep('✅ Generated HMAC signature', { signature: hashHex });
  
  return hashHex;
}

// Debug function to see exact signature string
async function debugSignatureString(payload: any): Promise<string> {
  // CRITICAL: According to Bumper API docs, exclude these fields from signature:
  // api_key, signature, product_description, preferred_product_type, additional_data, instalments
  const excludedFields = new Set([
    'api_key', 
    'signature', 
    'product_description', 
    'preferred_product_type', 
    'additional_data',
    'instalments' // This is our custom field, not part of signature
  ]);

  // Build the signature payload with ALL payload fields EXCEPT excluded ones
  const signaturePayload: any = {};
  
  for (const [field, fieldValue] of Object.entries(payload)) {
    // Skip excluded fields
    if (excludedFields.has(field)) {
      continue;
    }
    
    let value = fieldValue;
    
    // Handle missing values - convert to empty string
    if (value === null || value === undefined) {
      value = '';
    } else if (typeof value === 'boolean') {
      // Convert boolean to string exactly as Bumper expects: True/False (capitalized)
      value = value ? 'True' : 'False';
    } else {
      // Convert to string and handle URL decoding for URL fields
      value = String(value);
      
      // CRITICAL: URLs must NOT be URL encoded for signature generation
      // Bumper expects raw URLs in the signature string
      if (field === 'success_url' || field === 'failure_url') {
        // Decode URLs to ensure they're not double-encoded
        try {
          value = decodeURIComponent(String(value));
        } catch (e) {
          // If decoding fails, use the original value
          console.log(`BUMPER DEBUG: Failed to decode URL ${field}: ${value}`);
        }
      }
    }
    
    signaturePayload[field] = value;
  }

  // Sort keys alphabetically (case-sensitive as per Bumper API)
  const sortedKeys = Object.keys(signaturePayload).sort();

  // Build signature string exactly like Bumper API documentation
  const signatureParts = [];
  for (const key of sortedKeys) {
    const value = signaturePayload[key];
    // Bumper format: KEY=value (KEY must be uppercase)
    signatureParts.push(`${key.toUpperCase()}=${value}`);
  }
  
  // CRITICAL: Bumper requires trailing "&" at the end of signature string per their API docs
  return signatureParts.join('&') + '&';
}