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

// Server-side Google Ads conversion tracking
async function fireServerSideConversion(
  session: any,
  customerEmail: string,
  transactionValue: number,
  warrantyNumber: string
): Promise<void> {
  try {
    const gclid = session.metadata?.gclid;
    const clientId = session.metadata?.ga_client_id;
    
    if (!gclid) {
      logStep("No GCLID found for conversion tracking", { 
        sessionId: session.id,
        hasClientId: !!clientId 
      });
      return;
    }

    logStep("Firing server-side Google Ads conversion", {
      gclid,
      clientId,
      value: transactionValue,
      warrantyNumber
    });

    // Google Ads Conversion Tracking via Measurement Protocol
    const conversionData = {
      client_id: clientId || `stripe_${session.id}`,
      events: [{
        name: 'purchase',
        params: {
          transaction_id: warrantyNumber || session.id,
          value: transactionValue,
          currency: 'GBP',
          gclid: gclid,
          items: [{
            item_name: session.metadata?.plan_type || 'Warranty',
            price: transactionValue,
            quantity: 1
          }]
        }
      }]
    };

    // Send to Google Analytics 4 Measurement Protocol
    const GA4_MEASUREMENT_ID = 'G-9YWNWZ8XNS';
    const GA4_API_SECRET = Deno.env.get('GA4_API_SECRET');

    if (GA4_API_SECRET) {
      const ga4Response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
        {
          method: 'POST',
          body: JSON.stringify(conversionData)
        }
      );
      
      logStep("GA4 Measurement Protocol response", { 
        status: ga4Response.status,
        ok: ga4Response.ok 
      });
    } else {
      logStep("GA4_API_SECRET not configured, skipping GA4 server-side tracking");
    }

    // Also send enhanced conversion data via Google Ads API if available
    // This uses hashed email for enhanced conversions
    const hashedEmail = await hashEmail(customerEmail);
    
    logStep("Server-side conversion fired successfully", {
      gclid,
      warrantyNumber,
      hashedEmail: hashedEmail.substring(0, 10) + '...'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error firing server-side conversion", { error: errorMessage });
    // Don't throw - conversion tracking failure shouldn't block the purchase
  }
}

// Hash email for enhanced conversions
async function hashEmail(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

          // CRITICAL: Use actual Stripe payment amount, not metadata.final_amount (which may be pre-discount)
          // session.amount_total is in cents/pence, divide by 100 to get pounds
          const actualStripeAmount = (fullSession.amount_total || 0) / 100;
          const metadataAmount = parseFloat(fullSession.metadata?.final_amount || '0');
          
          logStep("Payment amount comparison", {
            actualStripeAmount,
            metadataAmount,
            usingActualStripeAmount: actualStripeAmount > 0
          });

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
            discount_amount: (actualStripeAmount > 0 && metadataAmount > actualStripeAmount) 
              ? (metadataAmount - actualStripeAmount) 
              : parseFloat(fullSession.metadata?.discount_amount || '0'),
            // Use ACTUAL Stripe payment amount - this is what the customer actually paid
            final_amount: actualStripeAmount > 0 ? actualStripeAmount : metadataAmount,
            original_amount: metadataAmount, // Store metadata amount as original (pre-discount)
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
            const labourRate = parseInt(fullSession.metadata?.labour_rate || '70');
            const startDate = fullSession.metadata?.start_date || null;
            
            logStep("Extracted add-ons, claim limit, seasonal bonus, labour rate, and start date", { 
              protectionAddOns, claimLimit, seasonalBonusMonths, labourRate, startDate 
            });

            // Check if this is from a live quote — defer warranty creation to sales agent
            if (fullSession.metadata?.source === 'live_quote' && fullSession.metadata?.quote_id) {
              logStep("Live quote payment — deferring warranty creation to sales agent", { 
                quoteId: fullSession.metadata.quote_id 
              });
              
              // Only update the quote status to paid — NO customer/policy creation
              await supabaseClient
                .from('live_quotes')
                .update({ 
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  payment_method: 'stripe',
                })
                .eq('id', fullSession.metadata.quote_id);
              
              logStep("Live quote marked as paid. Sales agent will complete order manually.");
              
              // Still fire Google Ads conversion for tracking
              await fireServerSideConversion(
                fullSession,
                vehicleData.email,
                parseFloat(fullSession.metadata?.final_amount || '0'),
                ''
              );
            } else {
              // Non-quote payment (direct website checkout) — process normally
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
                  claimLimit: claimLimit,
                  seasonalBonusMonths: seasonalBonusMonths,
                  labourRate: labourRate,
                  startDate: startDate,
                  metadata: fullSession.metadata || {},
                  skipEmail: false
                }
              });

              if (processError) {
                logStep("Error processing payment via handle-successful-payment", processError);
                throw new Error(`Payment processing failed: ${processError.message}`);
              }

              logStep("Payment processed successfully via webhook", processData);
              
              // Fire server-side Google Ads conversion
              await fireServerSideConversion(
                fullSession,
                vehicleData.email,
                parseFloat(fullSession.metadata?.final_amount || '0'),
                processData?.warrantyNumber || processData?.policyNumber || ''
              );
            }
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

    // Handle embedded checkout payment_intent.succeeded events
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      logStep("Processing PaymentIntent succeeded", { 
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        isEmbeddedCheckout: paymentIntent.metadata?.is_embedded_checkout
      });

      // Only process embedded checkout payments (not other PaymentIntents)
      if (paymentIntent.metadata?.is_embedded_checkout === 'true') {
        const metadata = paymentIntent.metadata;
        
        // Extract vehicle data from metadata
        const vehicleData = {
          regNumber: metadata.vehicle_reg || '',
          mileage: metadata.vehicle_mileage || '',
          make: metadata.vehicle_make || '',
          model: metadata.vehicle_model || '',
          year: metadata.vehicle_year || '',
          fuelType: metadata.vehicle_fuel_type || '',
          transmission: metadata.vehicle_transmission || '',
          vehicleType: metadata.vehicle_type || 'standard',
          fullName: metadata.customer_name || '',
          phone: metadata.customer_phone || '',
          address: `${metadata.customer_street || ''} ${metadata.customer_town || ''} ${metadata.customer_county || ''} ${metadata.customer_postcode || ''}`.trim(),
          email: metadata.customer_email || ''
        };

        // CRITICAL: Use actual Stripe payment amount for embedded checkout
        // paymentIntent.amount is in cents/pence, divide by 100 to get pounds
        const actualStripeAmount = (paymentIntent.amount || 0) / 100;
        const metadataAmount = parseFloat(metadata.final_amount || '0');
        
        logStep("PaymentIntent amount comparison", {
          actualStripeAmount,
          metadataAmount,
          usingActualStripeAmount: actualStripeAmount > 0
        });

        // Extract customer data from metadata
        const customerData = {
          first_name: metadata.customer_first_name || '',
          last_name: metadata.customer_last_name || '',
          mobile: metadata.customer_phone || '',
          street: metadata.customer_street || '',
          town: metadata.customer_town || '',
          county: metadata.customer_county || '',
          postcode: metadata.customer_postcode || '',
          country: metadata.customer_country || 'United Kingdom',
          building_name: metadata.customer_building_name || '',
          flat_number: metadata.customer_flat_number || '',
          building_number: metadata.customer_building_number || '',
          vehicle_reg: metadata.vehicle_reg || '',
          discount_code: metadata.discount_code || '',
          // Use ACTUAL Stripe payment amount - this is what the customer actually paid
          final_amount: actualStripeAmount > 0 ? actualStripeAmount : metadataAmount,
          original_amount: metadataAmount, // Store metadata amount as original (pre-discount)
          fullName: metadata.customer_name || '',
          phone: metadata.customer_phone || '',
          address: `${metadata.customer_street || ''}, ${metadata.customer_town || ''}, ${metadata.customer_county || ''}, ${metadata.customer_postcode || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim()
        };

        logStep("Extracted customer and vehicle data from PaymentIntent", { vehicleData, customerData });

        // Extract add-ons from metadata
        const protectionAddOns = {
          tyre: metadata.addon_tyre_cover === 'true',
          wearTear: metadata.addon_wear_tear === 'true',
          european: metadata.addon_europe_cover === 'true',
          transfer: metadata.addon_transfer_cover === 'true',
          breakdown: metadata.addon_breakdown_recovery === 'true',
          rental: metadata.addon_vehicle_rental === 'true',
          motFee: metadata.addon_mot_fee === 'true',
          motRepair: metadata.addon_mot_repair === 'true',
          lostKey: metadata.addon_lost_key === 'true',
          consequential: metadata.addon_consequential === 'true'
        };

        const claimLimit = parseInt(metadata.claim_limit || '1250');
        const labourRate = parseInt(metadata.labour_rate || '70');
        const seasonalBonusMonths = parseInt(metadata.seasonal_bonus_months || '0');
        const startDate = metadata.start_date || null;
        
        logStep("Extracted add-ons, claim limit, labour rate from PaymentIntent", { 
          protectionAddOns, claimLimit, labourRate, seasonalBonusMonths, startDate 
        });

        if (metadata.source === 'live_quote' && metadata.quote_id) {
          logStep("Embedded live quote payment — deferring warranty creation to sales agent", {
            quoteId: metadata.quote_id,
            paymentIntentId: paymentIntent.id,
          });

          const { error: quoteUpdateError } = await supabaseClient
            .from('live_quotes')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payment_method: 'stripe',
            })
            .eq('id', metadata.quote_id);

          if (quoteUpdateError) {
            logStep("Error updating embedded live quote status", quoteUpdateError);
            throw new Error(`Failed to update live quote: ${quoteUpdateError.message}`);
          }

          await fireServerSideConversion(
            { id: paymentIntent.id, metadata },
            vehicleData.email,
            parseFloat(metadata.final_amount || '0'),
            ''
          );
        } else {
          // Call handle-successful-payment
          const { data: processData, error: processError } = await supabaseClient.functions.invoke('handle-successful-payment', {
            body: {
              planId: metadata.plan_id || metadata.plan_type,
              paymentType: metadata.payment_type,
              userEmail: vehicleData.email,
              userId: metadata.user_id || null,
              stripeSessionId: paymentIntent.id, // Use PaymentIntent ID as session ID
              vehicleData: vehicleData,
              customerData: customerData,
              protectionAddOns: protectionAddOns,
              claimLimit: claimLimit,
              labourRate: labourRate,
              seasonalBonusMonths: seasonalBonusMonths,
              startDate: startDate,
              metadata: metadata,
              skipEmail: false
            }
          });

          if (processError) {
            logStep("Error processing embedded payment via handle-successful-payment", processError);
            throw new Error(`Embedded payment processing failed: ${processError.message}`);
          }

          logStep("Embedded payment processed successfully via webhook", processData);
          
          // Fire server-side Google Ads conversion
          await fireServerSideConversion(
            { id: paymentIntent.id, metadata }, // Mock session object structure
            vehicleData.email,
            parseFloat(metadata.final_amount || '0'),
            processData?.warrantyNumber || processData?.policyNumber || ''
          );
        }
      } else {
        logStep("PaymentIntent succeeded but not from embedded checkout, skipping", { 
          paymentIntentId: paymentIntent.id 
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