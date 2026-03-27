import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[QUOTE-PAYMENT] ${timestamp} ${step}${detailsStr}`);
};

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
    const { accessToken, paymentMethod, customerData: providedCustomerData, discountCode } = body;

    logStep("Request data", { 
      accessToken: accessToken?.substring(0, 8) + '...', 
      paymentMethod,
      hasCustomerData: !!providedCustomerData
    });

    if (!accessToken || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken or paymentMethod" }),
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
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if quote has expired
    if (new Date(quote.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This quote has expired", expired: true }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already paid
    if (quote.status === 'paid') {
      return new Response(
        JSON.stringify({ error: "This quote has already been paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Quote found", { quoteId: quote.id, status: quote.status });

    const submittedCustomerData = providedCustomerData || {};
    const submittedFullName = submittedCustomerData.fullName?.trim() ||
      `${submittedCustomerData.firstName || ''} ${submittedCustomerData.lastName || ''}`.trim();
    const resolvedCustomerName = submittedFullName || quote.customer_name || '';
    const nameParts = resolvedCustomerName.split(' ').filter(Boolean);
    const resolvedFirstName = submittedCustomerData.firstName || nameParts[0] || '';
    const resolvedLastName = submittedCustomerData.lastName || nameParts.slice(1).join(' ') || '';
    const resolvedEmail = submittedCustomerData.email || quote.customer_email || '';
    const resolvedPhone = submittedCustomerData.phone || quote.customer_phone || '';
    const resolvedStreet = submittedCustomerData.addressLine1 || '';
    const resolvedAddressLine2 = submittedCustomerData.addressLine2 || '';
    const resolvedTown = submittedCustomerData.city || '';
    const resolvedPostcode = submittedCustomerData.postcode || '';
    const resolvedStartDate = submittedCustomerData.startDate || null;

    await supabaseClient
      .from('live_quotes')
      .update({
        customer_name: resolvedCustomerName || quote.customer_name,
        customer_email: resolvedEmail || quote.customer_email,
        customer_phone: resolvedPhone || quote.customer_phone || null,
      })
      .eq('id', quote.id);

    const origin = "https://buyawarranty.co.uk";

    if (paymentMethod === 'stripe') {
      // Create Stripe checkout session
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecretKey) {
        throw new Error("Stripe secret key not configured");
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
      });

      // Calculate amount in pence
      const amountInPence = Math.round(quote.upfront_price * 100);

      // Calculate total months for display
      const totalMonths = quote.duration_months + (quote.bonus_months || 0);
      
      // Build thank you URL with all parameters for conversion tracking and display
      const thankYouParams = new URLSearchParams({
        source: 'stripe',
        plan: quote.plan_type || 'Platinum',
        duration: `${totalMonths}months`,
        payment: 'full',
        final_amount: quote.upfront_price.toString(),
        email: resolvedEmail,
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        mobile: resolvedPhone,
        street: resolvedStreet,
        town: resolvedTown,
        postcode: resolvedPostcode,
        vehicle_reg: quote.vehicle_reg || '',
        vehicle_make: quote.vehicle_make || '',
        vehicle_model: quote.vehicle_model || '',
        mileage: quote.vehicle_mileage || '',
        claim_limit: (quote.claim_limit || 1250).toString(),
        excess: (quote.excess_amount || 75).toString(),
        labour_rate: (quote.labour_rate || 70).toString(),
        session_id: '{CHECKOUT_SESSION_ID}'
      });

      // Look up Stripe coupon if discount code provided
      let stripeCoupon = null;
      if (discountCode) {
        try {
          const coupons = await stripe.coupons.list({ limit: 100 });
          stripeCoupon = coupons.data.find((c: any) => c.name === discountCode && c.valid);
          if (stripeCoupon) {
            logStep("Found Stripe coupon for discount code", { discountCode, couponId: stripeCoupon.id });
          } else {
            logStep("No matching Stripe coupon found", { discountCode });
          }
        } catch (couponErr) {
          logStep("Error looking up coupon", { discountCode, error: couponErr });
        }
      }

      const sessionConfig: any = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: `${quote.plan_type} Vehicle Warranty - ${totalMonths} Months`,
                description: `${quote.vehicle_make} ${quote.vehicle_model} (${quote.vehicle_reg})`,
              },
              unit_amount: amountInPence,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: resolvedEmail,
        success_url: `${origin}/payment-received?${thankYouParams.toString()}`,
        cancel_url: `${origin}/quote/${accessToken}?cancelled=1`,
        metadata: {
          quote_id: quote.id,
          access_token: accessToken,
          vehicle_reg: quote.vehicle_reg,
          source: 'live_quote',
          plan_type: quote.plan_type,
          payment_type: `${totalMonths}months`,
          final_amount: quote.upfront_price.toString(),
          customer_email: resolvedEmail,
          customer_name: resolvedCustomerName,
          customer_first_name: resolvedFirstName,
          customer_last_name: resolvedLastName,
          customer_phone: resolvedPhone,
          customer_street: resolvedStreet,
          customer_town: resolvedTown,
          customer_postcode: resolvedPostcode,
          customer_country: 'United Kingdom',
          customer_building_name: resolvedAddressLine2,
          start_date: resolvedStartDate || '',
          vehicle_make: quote.vehicle_make,
          vehicle_model: quote.vehicle_model,
          vehicle_year: quote.vehicle_year,
          vehicle_mileage: quote.vehicle_mileage || '',
          claim_limit: (quote.claim_limit || 1250).toString(),
          excess_amount: (quote.excess_amount || 75).toString(),
          labour_rate: (quote.labour_rate || 70).toString(),
          discount_code: discountCode || ''
        }
      };

      if (stripeCoupon) {
        sessionConfig.discounts = [{ coupon: stripeCoupon.id }];
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      logStep("Stripe session created", { sessionId: session.id });

      // Update quote status to viewed (if not already)
      await supabaseClient
        .from('live_quotes')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', quote.id)
        .is('viewed_at', null);

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (paymentMethod === 'bumper') {
      // Create Bumper checkout
      const bumperApiKey = Deno.env.get("BUMPER_API_KEY");
      const bumperSecretKey = Deno.env.get("BUMPER_SECRET_KEY");

      if (!bumperApiKey || !bumperSecretKey) {
        throw new Error("Bumper API keys not configured");
      }

      const totalAmount = quote.monthly_price * 12; // Total for Bumper finance
      const transactionId = `LQ-${quote.id.substring(0, 8)}-${Date.now()}`;

      logStep("Customer data for Bumper", {
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        street: resolvedStreet,
        town: resolvedTown,
        postcode: resolvedPostcode,
        hasProvidedData: !!providedCustomerData
      });

      const bumperSuccessParams = new URLSearchParams({
        quote_token: accessToken,
        email: resolvedEmail,
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        mobile: resolvedPhone,
        street: resolvedStreet,
        town: resolvedTown,
        postcode: resolvedPostcode,
      });

      const successUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-quote-bumper-success?${bumperSuccessParams.toString()}`;
      const failureUrl = `${origin}/quote/${accessToken}?failed=1`;

      // Build signature payload - must include ALL fields that will be in the request
      const signaturePayload = {
        amount: totalAmount.toFixed(2),
        success_url: successUrl,
        failure_url: failureUrl,
        currency: "GBP",
        order_reference: transactionId,
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        email: resolvedEmail,
        mobile: resolvedPhone,
        vehicle_reg: quote.vehicle_reg || '',
        flat_number: "",
        building_name: resolvedAddressLine2,
        building_number: "",
        street: resolvedStreet,
        town: resolvedTown,
        county: "",
        postcode: resolvedPostcode,
        country: "UK",
        product_id: "4",
        send_sms: false,
        send_email: false
      };

      // Generate signature using the correct Bumper algorithm
      const signature = await generateSignature(signaturePayload, bumperSecretKey);

      // Build the actual request data
      const bumperRequestData: Record<string, any> = {
        ...signaturePayload,
        preferred_product_type: "paylater",
        api_key: bumperApiKey,
        signature: signature,
        product_description: [{
          item: `${quote.plan_type} Vehicle Warranty - ${quote.duration_months + quote.bonus_months} Months`,
          quantity: "1",
          price: totalAmount.toFixed(2)
        }]
      };

      logStep("Calling Bumper API", { 
        transactionId,
        signatureGenerated: !!signature,
        totalAmount: totalAmount.toFixed(2)
      });

      const bumperResponse = await fetch("https://api.bumper.co/v2/apply/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bumperRequestData),
      });

      const bumperData = await bumperResponse.json();

      if (bumperData?.data?.redirect_url) {
        logStep("Bumper session created", { redirectUrl: bumperData.data.redirect_url });

        // Update quote status
        await supabaseClient
          .from('live_quotes')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', quote.id)
          .is('viewed_at', null);

        return new Response(
          JSON.stringify({ url: bumperData.data.redirect_url }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        logStep("Bumper API error", { response: bumperData });
        throw new Error(bumperData?.message || bumperData?.error || "Failed to create Bumper session");
      }

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payment method. Use 'stripe' or 'bumper'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    logStep("Unexpected error", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
