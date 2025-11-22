import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook request received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify the webhook signature (you'll need to set STRIPE_WEBHOOK_SECRET)
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      logStep("Processing completed checkout session", { 
        sessionId: session.id,
        customerEmail: session.customer_email,
        mode: session.mode,
        paymentStatus: session.payment_status,
        isMultiWarranty: session.metadata?.is_multi_warranty
      });

      // Only process if payment was successful
      if (session.payment_status === "paid") {
        // Check if this is a multi-warranty purchase
        if (session.metadata?.is_multi_warranty === "true") {
          logStep("Processing multi-warranty purchase", { sessionId: session.id });
          
          // Call the multi-warranty processing function
          const { data, error } = await supabaseClient.functions.invoke('process-multi-warranty-stripe-success', {
            body: { sessionId: session.id }
          });

          if (error) {
            logStep("Multi-warranty processing failed", { error: error.message });
            throw new Error(`Multi-warranty processing failed: ${error.message}`);
          } else {
            logStep("Multi-warranty processing completed", data);
          }
        } else {
          logStep("Processing single warranty purchase", { sessionId: session.id });
          // Extract metadata to determine the plan and payment type
          const planId = session.metadata?.plan_id || session.metadata?.plan_type;
          const paymentType = session.metadata?.payment_type;
          
          if (planId && paymentType) {
          // Retrieve the checkout session to get customer data
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
            apiVersion: "2023-10-16" 
          });
          
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['customer']
          });
          
          // Extract customer and vehicle data from session metadata
          const vehicleData = {
            regNumber: fullSession.metadata?.vehicle_reg || '',
            mileage: fullSession.metadata?.vehicle_mileage || '',
            make: fullSession.metadata?.vehicle_make || '',
            model: fullSession.metadata?.vehicle_model || '',
            year: fullSession.metadata?.vehicle_year || '',
            fuelType: fullSession.metadata?.vehicle_fuel_type || '',
            transmission: fullSession.metadata?.vehicle_transmission || '',
            vehicleType: fullSession.metadata?.vehicle_type || 'standard',
            fullName: fullSession.metadata?.customer_name || '',
            phone: fullSession.metadata?.customer_phone || '',
            address: `${fullSession.metadata?.customer_street || ''} ${fullSession.metadata?.customer_town || ''} ${fullSession.metadata?.customer_county || ''} ${fullSession.metadata?.customer_postcode || ''}`.trim(),
            email: fullSession.customer_email || fullSession.customer_details?.email || fullSession.metadata?.customer_email || ''
          };

          const customerData = {
            first_name: fullSession.metadata?.customer_first_name || '',
            last_name: fullSession.metadata?.customer_last_name || '',
            mobile: fullSession.metadata?.customer_phone || '',
            street: fullSession.metadata?.customer_street || '',
            town: fullSession.metadata?.customer_town || '',
            county: fullSession.metadata?.customer_county || '',
            postcode: fullSession.metadata?.customer_postcode || '',
            country: fullSession.metadata?.customer_country || 'United Kingdom',
            building_name: fullSession.metadata?.customer_building_name || '',
            flat_number: fullSession.metadata?.customer_flat_number || '',
            building_number: fullSession.metadata?.customer_building_number || '',
            vehicle_reg: fullSession.metadata?.vehicle_reg || '',
            discount_code: fullSession.metadata?.discount_code || '',
            final_amount: parseFloat(fullSession.metadata?.final_amount || '0'),
            fullName: fullSession.metadata?.customer_name || '',
            phone: fullSession.metadata?.customer_phone || '',
            address: `${fullSession.metadata?.customer_street || ''}, ${fullSession.metadata?.customer_town || ''}, ${fullSession.metadata?.customer_county || ''}, ${fullSession.metadata?.customer_postcode || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim()
          };

          logStep("Extracted customer and vehicle data from webhook", { vehicleData, customerData });

           // Extract add-ons and claim limit from metadata
           const protectionAddOns = {
             tyre: fullSession.metadata?.addon_tyre_cover === 'true',
             wearTear: fullSession.metadata?.addon_wear_tear === 'true',
             european: fullSession.metadata?.addon_europe_cover === 'true',
             transfer: fullSession.metadata?.addon_transfer_cover === 'true',
             breakdown: fullSession.metadata?.addon_breakdown_recovery === 'true',
             rental: fullSession.metadata?.addon_vehicle_rental === 'true',
             motFee: fullSession.metadata?.addon_mot_fee === 'true',
             motRepair: fullSession.metadata?.addon_mot_repair === 'true',
             lostKey: fullSession.metadata?.addon_lost_key === 'true',
             consequential: fullSession.metadata?.addon_consequential === 'true'
            };

            const claimLimit = parseInt(fullSession.metadata?.claim_limit || '1250');
            const seasonalBonusMonths = parseInt(fullSession.metadata?.seasonal_bonus_months || '0');
            
            logStep("Extracted add-ons, claim limit, and seasonal bonus", { protectionAddOns, claimLimit, seasonalBonusMonths });

            // Call handle-successful-payment directly
            const { data: processData, error: processError } = await supabaseClient.functions.invoke('handle-successful-payment', {
              body: {
                planId: fullSession.metadata?.plan_id || planId,
                paymentType: fullSession.metadata?.payment_type || paymentType,
                userEmail: vehicleData.email,
                userId: fullSession.metadata?.user_id || null,
                stripeSessionId: session.id,
                vehicleData: vehicleData,
                customerData: customerData,
                protectionAddOns: protectionAddOns,
                claim_limit: claimLimit,
                seasonalBonusMonths: seasonalBonusMonths,
                metadata: fullSession.metadata || {},
                skipEmail: false // Allow email sending
              }
            });

          if (processError) {
            logStep("Error processing payment via handle-successful-payment", processError);
            throw new Error(`Payment processing failed: ${processError.message}`);
          }

            logStep("Payment processed successfully via webhook", processData);
          } else {
            logStep("Warning: Missing plan_id or payment_type in session metadata", {
              planId,
              paymentType,
              metadata: session.metadata
            });
          }
        }
      } else {
        logStep("Payment not completed, skipping processing", { 
          paymentStatus: session.payment_status 
        });
      }
    }

    // Handle subscription events if needed
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      logStep("Invoice payment succeeded", { 
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription
      });
      
      // Handle subscription payment success if needed
    }

    // Return success response
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe webhook", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});