import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MULTI-WARRANTY-BUMPER-CHECKOUT] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let items: any[] = [];
  let customerData: any = {};
  let discountCode: string | null = null;
  let originalAmount = 0;
  let finalAmount = 0;
  let totalAmount = 0;
  let actualTotalAmount = 0;

  try {
    logStep("Multi-warranty Bumper checkout started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const body = await req.json();
    ({ items, customerData, discountCode, originalAmount, finalAmount, totalAmount } = body);
    actualTotalAmount = finalAmount || totalAmount;
    logStep("Request data", { itemCount: items.length, originalAmount, finalAmount, actualTotalAmount, customerData, discountCode });

    // Get authenticated user
    let user = null;
    let customerEmail = customerData?.email || "guest@buyawarranty.co.uk";
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== "Bearer null") {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
        if (user?.email) {
          customerEmail = user.email;
          logStep("User authenticated", { userId: user.id, email: user.email });
        }
      } catch (authError) {
        logStep("Auth failed, proceeding as guest", { error: authError });
      }
    } else {
      logStep("No auth header, proceeding as guest checkout");
    }

    // Prepare Bumper API request
    const bumperApiKey = Deno.env.get("BUMPER_API_KEY");
    const bumperSecretKey = Deno.env.get("BUMPER_SECRET_KEY");
    
    logStep("Checking Bumper credentials", { 
      hasApiKey: !!bumperApiKey, 
      hasSecretKey: !!bumperSecretKey,
      apiKeyLength: bumperApiKey?.length || 0,
      secretKeyLength: bumperSecretKey?.length || 0
    });
    
    if (!bumperApiKey || !bumperSecretKey) {
      logStep("Missing Bumper credentials - returning fallback flag");
      
      return new Response(JSON.stringify({ 
        fallbackToStripe: true,
        fallbackReason: "missing_credentials",
        fallbackData: {
          items,
          customerData,
          discountCode,
          originalAmount,
          finalAmount: actualTotalAmount
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!customerData) {
      logStep("No customer data provided, returning fallback flag");
      
      return new Response(JSON.stringify({ 
        fallbackToStripe: true,
        fallbackReason: "no_customer_data",
        fallbackData: {
          items,
          customerData,
          discountCode,
          originalAmount,
          finalAmount: actualTotalAmount
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const origin = req.headers.get("origin") || "https://buyawarranty.com";
    
    // Create product description for all warranties
    const productDescription = items.map((item: any, index: number) => ({
      item: `${item.planName} Vehicle Warranty - Vehicle ${index + 1} (${item.vehicleData.regNumber})`,
      quantity: "1",
      price: item.totalPrice.toString()
    }));

    // Create vehicle registration list for reference
    const vehicleRegs = items.map((item: any) => item.vehicleData.regNumber).join(", ");
    // Build URLs for signature (unencoded) and request (encoded) separately
    const baseSuccessUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-multi-warranty-bumper-success?items=${JSON.stringify(items)}&customer_data=${JSON.stringify(customerData)}&discount_code=${discountCode || ''}&total_amount=${actualTotalAmount}&redirect=${origin + '/thank-you'}`;
    const baseFailureUrl = `${origin}/payment-fallback?multi=true&email=${customerData.email}&total=${actualTotalAmount}`;
    
    // Encoded URLs for the actual HTTP request
    const encodedSuccessUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-multi-warranty-bumper-success?items=${encodeURIComponent(JSON.stringify(items))}&customer_data=${encodeURIComponent(JSON.stringify(customerData))}&discount_code=${encodeURIComponent(discountCode || '')}&total_amount=${actualTotalAmount}&redirect=${encodeURIComponent(origin + '/thank-you')}`;
    const encodedFailureUrl = `${origin}/payment-fallback?multi=true&email=${encodeURIComponent(customerData.email)}&total=${actualTotalAmount}`;

    // Create payload for signature generation (with unencoded URLs)
    const signaturePayload = {
      amount: actualTotalAmount.toString(),
      preferred_product_type: "paylater",
      api_key: bumperApiKey,
      success_url: baseSuccessUrl, // Unencoded for signature
      failure_url: baseFailureUrl, // Unencoded for signature
      currency: "GBP",
      order_reference: `MULTI-VW-${Date.now()}`,
      invoice_number: `INV-MULTI-${Date.now()}`,
      user_email: "info@buyawarranty.co.uk",
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      email: customerData.email,
      mobile: customerData.mobile,
      vehicle_reg: vehicleRegs,
      instalments: "12",
      flat_number: customerData.flat_number || "",
      building_name: customerData.building_name || "",
      building_number: customerData.building_number || "",
      street: customerData.street || "",
      town: customerData.town,
      county: customerData.county,
      postcode: customerData.postcode,
      country: customerData.country,
      product_description: productDescription
    };

    // Store complete item data for later processing (before signature generation)
    const orderRef = signaturePayload.order_reference;
    const { error: storeError } = await supabaseClient
      .from('bumper_transactions')
      .insert({
        transaction_id: orderRef,
        plan_id: items[0]?.planName || 'multi-warranty',
        payment_type: '12months',
        customer_data: customerData,
        vehicle_data: items.map(item => item.vehicleData),
        protection_addons: items.reduce((acc, item, index) => {
          acc[`warranty_${index + 1}`] = item.protectionAddOns;
          return acc;
        }, {}),
        claim_limit: Math.max(...items.map(item => item.claimLimit || 1250)),
        final_amount: actualTotalAmount,
        discount_code: discountCode || '',
        redirect_url: `${origin}/thank-you`,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (storeError) {
      logStep("Error storing Bumper transaction", storeError);
    } else {
      logStep("Bumper transaction stored", { orderRef, itemCount: items.length });
    }
    
    // Create payload for actual HTTP request (with encoded URLs)
    const bumperRequestData = {
      amount: actualTotalAmount.toString(),
      preferred_product_type: "paylater",
      api_key: bumperApiKey,
      success_url: encodedSuccessUrl, // Encoded for HTTP request
      failure_url: encodedFailureUrl, // Encoded for HTTP request
      currency: "GBP",
      order_reference: `MULTI-VW-${Date.now()}`,
      invoice_number: `INV-MULTI-${Date.now()}`,
      user_email: "info@buyawarranty.co.uk",
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      email: customerData.email,
      mobile: customerData.mobile,
      vehicle_reg: vehicleRegs, // All vehicle registrations
      instalments: "12", // Always 12 for Bumper
      // Address fields
      flat_number: customerData.flat_number || "",
      building_name: customerData.building_name || "",
      building_number: customerData.building_number || "",
      street: customerData.street || "",
      town: customerData.town,
      county: customerData.county,
      postcode: customerData.postcode,
      country: customerData.country,
      product_description: productDescription
    };

    // Remove sensitive data from logs
    const loggableData = { ...bumperRequestData };
    if ('api_key' in loggableData) delete (loggableData as any).api_key;
    if ('signature' in loggableData) delete (loggableData as any).signature;
    logStep("Multi-warranty Bumper payload prepared", loggableData);

    // Generate signature using unencoded payload
    console.log("BUMPER DEBUG: Multi-warranty signature payload (unencoded URLs):", JSON.stringify(signaturePayload, null, 2));
    const signature = await generateSignature(signaturePayload, bumperSecretKey);
    (bumperRequestData as any).signature = signature;

    const bumperApiUrl = "https://api.bumper.co/v2/apply/";
    logStep("Making Bumper API request", { url: bumperApiUrl, actualTotalAmount, itemCount: items.length });

    const bumperResponse = await fetch(bumperApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bumperRequestData)
    });

    logStep("Bumper API response received", { 
      status: bumperResponse.status, 
      statusText: bumperResponse.statusText,
      ok: bumperResponse.ok
    });

    let bumperData;
    const responseText = await bumperResponse.text();
    console.log("Raw Bumper API response:", responseText);
    
    try {
      if (responseText) {
        bumperData = JSON.parse(responseText);
        console.log("Bumper API response data:", bumperData);
      } else {
        console.log("Empty response from Bumper API");
        logStep("Bumper API returned empty response - returning fallback flag");
        
        return new Response(JSON.stringify({ 
          fallbackToStripe: true,
          fallbackReason: "credit_check_failed",
          fallbackData: {
            items,
            customerData,
            discountCode,
            originalAmount,
            finalAmount: actualTotalAmount
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } catch (parseError) {
      console.log("Failed to parse Bumper API response as JSON:", parseError);
      
      logStep("Bumper API returned invalid JSON - credit check failed", { 
        status: bumperResponse.status,
        responseText: responseText.substring(0, 500)
      });
      
      return new Response(JSON.stringify({ 
        fallbackToStripe: true,
        fallbackReason: "credit_check_failed",
        fallbackData: {
          items,
          customerData,
          discountCode,
          originalAmount,
          finalAmount: actualTotalAmount
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Bumper API response", { status: bumperResponse.status, data: bumperData });

    if (!bumperResponse.ok) {
      logStep("Bumper API rejected - credit check failed", { 
        status: bumperResponse.status,
        error: bumperData,
        statusText: bumperResponse.statusText
      });
      
      return new Response(JSON.stringify({ 
        fallbackToStripe: true,
        fallbackReason: "credit_check_failed",
        fallbackData: {
          items,
          customerData,
          discountCode,
          originalAmount,
          finalAmount: actualTotalAmount
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (bumperData?.data?.redirect_url) {
      logStep("Multi-warranty Bumper application created successfully", { 
        redirect_url: bumperData.data.redirect_url, 
        token: bumperData.token 
      });
      
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
    logStep("ERROR in create-multi-warranty-bumper-checkout", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      fallbackToStripe: true,
      fallbackReason: "error",
      fallbackData: {
        items: items || [],
        customerData: customerData || {},
        discountCode: discountCode || null,
        originalAmount: originalAmount || 0,
        finalAmount: actualTotalAmount || 0
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

// Generate signature exactly like the WordPress plugin - FIXED VERSION
async function generateSignature(payload: any, secretKey: string): Promise<string> {
  // Keys to exclude from signature (from Bumper WordPress plugin)
  const excludedKeys = [
    'api_key',
    'signature', 
    'product_description',
    'preferred_product_type'
  ];

  // Filter payload to exclude those keys and handle values properly
  const filteredPayload: any = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!excludedKeys.includes(key)) {
      // Handle empty values - convert to empty string for signature
      if (value === null || value === undefined) {
        filteredPayload[key] = '';
      } else if (Array.isArray(value)) {
        // Skip arrays entirely for signature (like product_description)
        continue;
      } else {
        filteredPayload[key] = String(value);
      }
    }
  }

  // Sort keys alphabetically (case-insensitive like WordPress)
  const sortedKeys = Object.keys(filteredPayload).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // Build signature string exactly like WordPress plugin
  const signatureParts = [];
  for (const key of sortedKeys) {
    const value = filteredPayload[key];
    // WordPress format: KEY=value (no URL encoding for signature)
    signatureParts.push(`${key.toUpperCase()}=${value}`);
  }
  
  let signatureString = signatureParts.join('&');
  
  // Remove trailing '&' if exists
  if (signatureString.endsWith('&')) {
    signatureString = signatureString.slice(0, -1);
  }

  // Generate HMAC SHA-256 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const data = encoder.encode(signatureString);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}