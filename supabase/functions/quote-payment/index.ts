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
    const { accessToken, paymentMethod } = body;

    logStep("Request data", { accessToken: accessToken?.substring(0, 8) + '...', paymentMethod });

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

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: `${quote.plan_type} Vehicle Warranty - ${quote.duration_months + quote.bonus_months} Months`,
                description: `${quote.vehicle_make} ${quote.vehicle_model} (${quote.vehicle_reg})`,
              },
              unit_amount: amountInPence,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: quote.customer_email,
        success_url: `${origin}/quote/${accessToken}/success?method=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/quote/${accessToken}?cancelled=1`,
        metadata: {
          quote_id: quote.id,
          access_token: accessToken,
          vehicle_reg: quote.vehicle_reg,
          source: 'live_quote'
        }
      });

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

      // Parse customer name
      const nameParts = quote.customer_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const successUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-quote-bumper-success?quote_token=${accessToken}`;
      const failureUrl = `${origin}/quote/${accessToken}?failed=1`;

      const bumperRequestData: Record<string, any> = {
        amount: totalAmount.toFixed(2),
        preferred_product_type: "paylater",
        api_key: bumperApiKey,
        success_url: successUrl,
        failure_url: failureUrl,
        currency: "GBP",
        order_reference: transactionId,
        first_name: firstName,
        last_name: lastName,
        email: quote.customer_email,
        mobile: quote.customer_phone || "",
        vehicle_reg: quote.vehicle_reg,
        flat_number: "",
        building_name: "",
        building_number: "",
        street: "",
        town: "",
        county: "",
        postcode: "",
        country: "UK",
        product_id: "4",
        send_sms: false,
        send_email: false,
        product_description: [{
          item: `${quote.plan_type} Vehicle Warranty - ${quote.duration_months + quote.bonus_months} Months`,
          quantity: "1",
          price: totalAmount.toFixed(2)
        }]
      };

      // Generate signature
      const signaturePayload = { ...bumperRequestData };
      delete signaturePayload.api_key;
      delete signaturePayload.signature;
      delete signaturePayload.product_description;
      delete signaturePayload.preferred_product_type;
      delete signaturePayload.additional_data;

      const sortedKeys = Object.keys(signaturePayload).sort();
      let signatureString = '';
      for (const key of sortedKeys) {
        const value = signaturePayload[key];
        if (value !== undefined && value !== null && value !== '') {
          signatureString += `${key.toUpperCase()}=${value}&`;
        }
      }
      signatureString = signatureString.slice(0, -1);

      const encoder = new TextEncoder();
      const keyData = encoder.encode(bumperSecretKey);
      const messageData = encoder.encode(signatureString);
      const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      bumperRequestData.signature = signature;

      logStep("Calling Bumper API", { transactionId });

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
        throw new Error(bumperData?.error || "Failed to create Bumper session");
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
