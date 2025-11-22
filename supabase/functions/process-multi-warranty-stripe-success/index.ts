import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-MULTI-WARRANTY-STRIPE-SUCCESS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - processing multi-warranty Stripe success");

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
      throw new Error("Missing required parameter: sessionId");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Retrieve the checkout session with expanded data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items']
    });

    logStep("Retrieved Stripe session", { 
      sessionId: session.id,
      customerEmail: session.customer_email,
      metadata: session.metadata,
      isMultiWarranty: session.metadata?.is_multi_warranty
    });

    if (!session || session.payment_status !== 'paid') {
      throw new Error("Payment not completed or session not found");
    }

    // Check if this is a multi-warranty purchase
    const isMultiWarranty = session.metadata?.is_multi_warranty === "true";
    if (!isMultiWarranty) {
      throw new Error("This session is not a multi-warranty purchase");
    }

    // Get line items to process each warranty separately
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      expand: ['data.price.product']
    });

    logStep("Retrieved line items", { count: lineItems.data.length });

    // Extract common customer data from session metadata
    const commonCustomerData = {
      first_name: session.metadata?.customer_first_name || '',
      last_name: session.metadata?.customer_last_name || '',
      email: session.customer_email || session.metadata?.customer_email || '',
      mobile: session.metadata?.customer_phone || '',
      street: session.metadata?.customer_street || '',
      town: session.metadata?.customer_town || '',
      county: session.metadata?.customer_county || '',
      postcode: session.metadata?.customer_postcode || '',
      country: session.metadata?.customer_country || 'United Kingdom',
      building_name: session.metadata?.customer_building_name || '',
      flat_number: session.metadata?.customer_flat_number || '',
      building_number: session.metadata?.customer_building_number || '',
      discount_code: session.metadata?.discount_code || '',
      fullName: session.metadata?.customer_name || ''
    };

    logStep("Extracted common customer data", commonCustomerData);

    // Process each warranty separately
    const processedWarranties = [];
    
    for (let i = 0; i < lineItems.data.length; i++) {
      const lineItem = lineItems.data[i];
      const product = lineItem.price?.product;
      
      logStep(`Processing warranty ${i + 1}`, { 
        productName: product?.name,
        amount: lineItem.amount_total,
        metadata: product?.metadata
      });

      try {
        // Extract warranty-specific data from product metadata
        const vehicleReg = product?.metadata?.vehicle_reg || `Vehicle_${i + 1}`;
        const planName = product?.metadata?.plan_name || 'Basic';
        const paymentType = product?.metadata?.payment_type || 'yearly';
        
        const vehicleData = {
          regNumber: vehicleReg,
          mileage: product?.metadata?.vehicle_mileage || '',
          make: product?.metadata?.vehicle_make || '',
          model: product?.metadata?.vehicle_model || '',
          year: product?.metadata?.vehicle_year || '',
          fuelType: product?.metadata?.vehicle_fuel_type || '',
          transmission: product?.metadata?.vehicle_transmission || '',
          vehicleType: product?.metadata?.vehicle_type || 'standard'
        };

        // Calculate total price in pounds (Stripe stores in pence)
        const totalPrice = (lineItem.amount_total || 0) / 100;

        logStep(`Processing individual warranty ${i + 1}`, {
          vehicleReg,
          planName,
          paymentType,
          totalPrice
        });

        // Process this individual warranty using the existing handle-successful-payment function
        const { data: paymentData, error: paymentError } = await supabaseClient.functions.invoke('handle-successful-payment', {
          body: {
            planId: planName,
            paymentType: paymentType,
            userEmail: commonCustomerData.email,
            userId: session.metadata?.user_id || null,
            stripeSessionId: sessionId,
            vehicleData: vehicleData,
            customerData: {
              ...commonCustomerData,
              vehicle_reg: vehicleReg,
              final_amount: totalPrice
            },
            // Extract claim limit and voluntary excess from product metadata
            claimLimit: parseInt(product?.metadata?.claim_limit ?? '1250'),
            voluntaryExcess: product?.metadata?.voluntary_excess !== undefined ? parseInt(product.metadata.voluntary_excess) : 0,
            // Extract all add-on data from product metadata
            metadata: {
              addon_tyre_cover: product?.metadata?.addon_tyre_cover || 'false',
              addon_wear_tear: product?.metadata?.addon_wear_tear || 'false',
              addon_europe_cover: product?.metadata?.addon_europe_cover || 'false',
              addon_transfer_cover: product?.metadata?.addon_transfer_cover || 'false',
              addon_breakdown_recovery: product?.metadata?.addon_breakdown_recovery || 'false',
              addon_vehicle_rental: product?.metadata?.addon_vehicle_rental || 'false',
              addon_mot_fee: product?.metadata?.addon_mot_fee || 'false',
              addon_mot_repair: product?.metadata?.addon_mot_repair || 'false',
              addon_lost_key: product?.metadata?.addon_lost_key || 'false',
              addon_consequential: product?.metadata?.addon_consequential || 'false'
            }
            // Don't skip email - we want individual emails for each warranty
          }
        });

        if (paymentError) {
          logStep(`Error processing warranty ${i + 1}`, paymentError);
          throw new Error(`Payment processing failed for warranty ${i + 1}: ${paymentError.message}`);
        }

        logStep(`Warranty ${i + 1} processed successfully`, paymentData);

        processedWarranties.push({
          warrantyNumber: paymentData?.policyNumber || `Policy_${i + 1}`,
          vehicleReg: vehicleReg,
          planName: planName,
          totalPrice: totalPrice,
          customerId: paymentData?.customerId,
          policyId: paymentData?.policyId
        });

        // Send individual welcome email for this specific warranty
        if (paymentData?.customerId && paymentData?.policyId) {
          try {
            logStep(`Sending individual welcome email for warranty ${i + 1}`, { 
              customerId: paymentData.customerId, 
              policyId: paymentData.policyId,
              vehicleReg: vehicleReg,
              planName: planName
            });

            const emailPayload = {
              customerId: paymentData.customerId,
              policyId: paymentData.policyId
            };

            // Use the manual welcome email function for this specific warranty
            const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-welcome-email-manual', {
              body: emailPayload
            });
            
            logStep(`Email function response for warranty ${i + 1}`, {
              data: emailResult,
              error: emailError
            });

            if (emailError) {
              logStep(`ERROR: Welcome email failed for warranty ${i + 1}`, { 
                error: emailError,
                policyId: paymentData.policyId,
                vehicleReg: vehicleReg
              });
            } else {
              logStep(`SUCCESS: Welcome email sent for warranty ${i + 1}`, {
                result: emailResult,
                vehicleReg: vehicleReg,
                planName: planName
              });
            }

          } catch (emailError) {
            logStep(`Welcome email failed for warranty ${i + 1}`, { 
              error: emailError,
              message: emailError instanceof Error ? emailError.message : String(emailError),
              policyId: paymentData.policyId,
              vehicleReg: vehicleReg
            });
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep(`Failed to process warranty ${i + 1}`, { error: errorMessage });
        // Don't throw here - continue processing other warranties
        processedWarranties.push({
          warrantyNumber: `Error_${i + 1}`,
          vehicleReg: `Vehicle_${i + 1}`,
          planName: 'Unknown',
          totalPrice: 0,
          error: errorMessage
        });
      }
    }

    logStep("Multi-warranty Stripe success processing completed", { 
      processedCount: processedWarranties.length,
      customerEmail: commonCustomerData.email,
      sessionId: sessionId
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Multi-warranty payment processed and individual emails sent successfully",
      processedWarranties: processedWarranties,
      totalWarranties: processedWarranties.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-multi-warranty-stripe-success", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});