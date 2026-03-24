import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-QUOTE-BUMPER-SUCCESS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const url = new URL(req.url);
  logStep(`Incoming request: ${req.method} ${url.pathname}${url.search}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get quote token from URL
    const quoteToken = url.searchParams.get('quote_token');
    
    if (!quoteToken) {
      logStep("No quote token provided");
      return new Response(JSON.stringify({ error: 'Missing quote token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logStep("Fetching quote data", { quoteToken: quoteToken.substring(0, 8) + '...' });

    // Fetch the quote
    const { data: quote, error: quoteError } = await supabaseClient
      .from('live_quotes')
      .select('*')
      .eq('access_token', quoteToken)
      .single();

    if (quoteError || !quote) {
      logStep("Quote not found", { error: quoteError?.message });
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already paid
    if (quote.status === 'paid') {
      logStep("Quote already paid, redirecting to thank you page");
      
      const thankYouUrl = buildThankYouUrl(quote);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': thankYouUrl }
      });
    }

    logStep("Quote found", { 
      quoteId: quote.id, 
      status: quote.status,
      planType: quote.plan_type,
      monthlyPrice: quote.monthly_price,
      upfrontPrice: quote.upfront_price
    });

    // Update quote status to paid
    const { error: updateError } = await supabaseClient
      .from('live_quotes')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'bumper'
      })
      .eq('id', quote.id);

    if (updateError) {
      logStep("Error updating quote status", { error: updateError.message });
      throw new Error(`Failed to update quote status: ${updateError.message}`);
    }

    logStep("Quote marked as paid, now creating warranty...");

    // Calculate total amount (Bumper = 12 months of monthly payments)
    const totalAmount = quote.monthly_price * 12;
    const totalMonths = quote.duration_months + (quote.bonus_months || 0);

    // Use the exact customer details submitted on the quote page when available
    const customerName = quote.customer_name || '';
    const nameParts = customerName.split(' ').filter(Boolean);
    const firstName = url.searchParams.get('first_name') || nameParts[0] || '';
    const lastName = url.searchParams.get('last_name') || nameParts.slice(1).join(' ') || '';
    const submittedPhone = url.searchParams.get('mobile') || quote.customer_phone || '';
    const submittedStreet = url.searchParams.get('street') || '';
    const submittedTown = url.searchParams.get('town') || '';
    const submittedPostcode = url.searchParams.get('postcode') || '';
    const submittedEmail = url.searchParams.get('email') || quote.customer_email;

    // Build customer data for handle-successful-payment
    const customerData = {
      email: submittedEmail,
      first_name: firstName,
      last_name: lastName,
      fullName: customerName,
      phone: submittedPhone,
      mobile: submittedPhone,
      street: submittedStreet,
      town: submittedTown,
      address_line1: submittedStreet,
      city: submittedTown,
      postcode: submittedPostcode,
      final_amount: totalAmount,
      claimLimit: quote.claim_limit || 1250,
    };

    // Build vehicle data
    const vehicleData = {
      regNumber: quote.vehicle_reg,
      make: quote.vehicle_make,
      model: quote.vehicle_model,
      year: quote.vehicle_year,
      mileage: quote.vehicle_mileage || '',
      fuelType: quote.vehicle_fuel_type || '',
      transmission: quote.vehicle_transmission || ''
    };

    // Map duration to payment type format
    const paymentType = `${totalMonths}months`;

    // Build add-ons from quote
    const protectionAddOns = {
      breakdown: quote.breakdown_included || false,
      rental: quote.rental_included || false,
      tyre: false,
      wearAndTear: false,
      european: false,
      transfer: false,
      motRepair: false,
      motFee: false
    };

    // Generate bumper order ID
    const bumperOrderId = `LQ-${quote.id.substring(0, 8)}-${Date.now()}`;

    logStep("Invoking handle-successful-payment", {
      customerEmail: customerData.email,
      planId: quote.plan_type,
      paymentType,
      finalAmount: totalAmount,
      vehicleReg: vehicleData.regNumber,
      bumperOrderId,
      claimLimit: quote.claim_limit,
      labourRate: quote.labour_rate,
      excessAmount: quote.excess_amount
    });

    // Call handle-successful-payment to create the warranty
    // CRITICAL: userEmail is REQUIRED by handle-successful-payment
    const { data: paymentResult, error: paymentError } = await supabaseClient.functions.invoke('handle-successful-payment', {
      body: {
        userEmail: submittedEmail,
        customerData,
        vehicleData,
        planId: quote.plan_type,
        paymentType,
        finalAmount: totalAmount,
        discountCode: null,
        protectionAddOns,
        source: 'bumper',
        bumperOrderId,
        labourRate: quote.labour_rate || 70,
        claimLimit: quote.claim_limit || 1250,
        voluntaryExcess: quote.excess_amount || 75,
        metadata: {
          source: 'bumper',
          bumper_order_id: bumperOrderId,
          vehicle_reg: quote.vehicle_reg,
          vehicle_make: quote.vehicle_make,
          vehicle_model: quote.vehicle_model,
          vehicle_year: quote.vehicle_year,
          vehicle_fuel_type: quote.vehicle_fuel_type || '',
          vehicle_transmission: quote.vehicle_transmission || '',
          claim_limit: (quote.claim_limit || 1250).toString(),
          labour_rate: (quote.labour_rate || 70).toString(),
          final_amount: totalAmount.toString(),
        }
      }
    });

    if (paymentError) {
      logStep("Error from handle-successful-payment (network)", { error: paymentError.message });
      throw new Error(`Failed to create warranty: ${paymentError.message}`);
    }

    // CRITICAL: Also check for application-level errors in the response
    // supabase.functions.invoke may not set paymentError for HTTP 4xx/5xx responses
    if (paymentResult?.error) {
      logStep("Error from handle-successful-payment (application)", { error: paymentResult.error });
      throw new Error(`Failed to create warranty: ${paymentResult.error}`);
    }

    if (!paymentResult?.success && !paymentResult?.policyNumber && !paymentResult?.warrantyNumber) {
      logStep("Warning: handle-successful-payment returned unexpected result", { paymentResult });
    }

    logStep("Warranty created successfully", { 
      policyNumber: paymentResult?.policyNumber,
      warrantyNumber: paymentResult?.warrantyNumber 
    });

    // Update quote with policy number
    const policyNumber = paymentResult?.policyNumber || paymentResult?.warrantyNumber;
    if (policyNumber) {
      await supabaseClient
        .from('live_quotes')
        .update({ policy_number: policyNumber })
        .eq('id', quote.id);
    }

    // Send welcome email
    try {
      logStep("Sending welcome email...");
      
      const { error: emailError } = await supabaseClient.functions.invoke('send-welcome-email-manual', {
        body: {
          policyId: paymentResult?.policyId,
          customerEmail: customerData.email
        }
      });

      if (emailError) {
        logStep("Warning: Welcome email failed", { error: emailError.message });
      } else {
        logStep("Welcome email sent successfully");
      }
    } catch (emailErr) {
      logStep("Warning: Welcome email error", { error: String(emailErr) });
    }

    // Build thank you URL with all parameters
    const thankYouUrl = buildThankYouUrl(quote, policyNumber, totalAmount, customerData, vehicleData);
    
    logStep("Redirecting to thank you page", { url: thankYouUrl });

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': thankYouUrl
      }
    });

  } catch (error) {
    logStep("Error processing quote payment", { error: String(error) });
    
    // Redirect to quote page with error
    const url = new URL(req.url);
    const quoteToken = url.searchParams.get('quote_token');
    const errorUrl = quoteToken 
      ? `https://buyawarranty.co.uk/quote/${quoteToken}?failed=1`
      : 'https://buyawarranty.co.uk/?error=payment_failed';
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': errorUrl
      }
    });
  }
});

function buildThankYouUrl(
  quote: any, 
  policyNumber?: string, 
  totalAmount?: number,
  customerData?: any,
  vehicleData?: any
): string {
  const baseUrl = 'https://buyawarranty.co.uk/thank-you';
  const params = new URLSearchParams();
  
  // Source and payment info
  params.set('source', 'bumper');
  params.set('plan', quote.plan_type || 'Platinum');
  params.set('duration', `${quote.duration_months + (quote.bonus_months || 0)}months`);
  params.set('payment', 'bumper');
  
  // Amount - use monthly price * 12 for Bumper total
  const amount = totalAmount || (quote.monthly_price * 12);
  params.set('final_amount', amount.toString());
  params.set('monthly_price', quote.monthly_price?.toString() || '');
  
  // Policy number
  if (policyNumber || quote.policy_number) {
    params.set('policy_number', policyNumber || quote.policy_number);
  }
  
  // Customer details for conversion tracking
  if (customerData) {
    params.set('email', customerData.email || quote.customer_email || '');
    params.set('first_name', customerData.first_name || '');
    params.set('last_name', customerData.last_name || '');
    params.set('mobile', customerData.phone || quote.customer_phone || '');
    params.set('street', customerData.address_line1 || '');
    params.set('town', customerData.city || '');
    params.set('postcode', customerData.postcode || '');
  } else {
    params.set('email', quote.customer_email || '');
  }
  
  // Vehicle details
  if (vehicleData) {
    params.set('vehicle_reg', vehicleData.regNumber || quote.vehicle_reg || '');
    params.set('vehicle_make', vehicleData.make || quote.vehicle_make || '');
    params.set('vehicle_model', vehicleData.model || quote.vehicle_model || '');
    params.set('mileage', vehicleData.mileage || quote.vehicle_mileage || '');
  } else {
    params.set('vehicle_reg', quote.vehicle_reg || '');
    params.set('vehicle_make', quote.vehicle_make || '');
    params.set('vehicle_model', quote.vehicle_model || '');
  }
  
  // Cover details
  params.set('claim_limit', quote.claim_limit?.toString() || '1250');
  params.set('excess', quote.excess_amount?.toString() || '75');
  params.set('labour_rate', quote.labour_rate?.toString() || '70');
  
  // Add-ons
  const addons = [];
  if (quote.breakdown_included) addons.push('breakdown');
  if (quote.rental_included) addons.push('rental');
  if (quote.boost_addon) addons.push('boost');
  if (addons.length > 0) {
    params.set('addons', addons.join(','));
  }
  
  return `${baseUrl}?${params.toString()}`;
}
