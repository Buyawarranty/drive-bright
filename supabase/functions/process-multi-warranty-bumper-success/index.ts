import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-MULTI-WARRANTY-BUMPER-SUCCESS] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Processing multi-warranty Bumper success");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const items = JSON.parse(url.searchParams.get('items') || '[]');
    const customerData = JSON.parse(url.searchParams.get('customer_data') || '{}');
    const discountCode = url.searchParams.get('discount_code') || '';
    const totalAmount = parseFloat(url.searchParams.get('total_amount') || '0');
    const redirectUrl = url.searchParams.get('redirect') || 'https://buyawarranty.com/thank-you';

    logStep("Extracted parameters", { 
      itemCount: items.length, 
      totalAmount, 
      customerEmail: customerData.email,
      discountCode,
      redirectUrl
    });

    // Check for duplicate multi-warranty orders
    const uniqueOrderId = `MULTI-${customerData.email}-${items.map((i: any) => i.vehicleData.regNumber).join('-')}-${totalAmount}`;
    
    const { data: existingOrder, error: checkError } = await supabaseService
      .from('customers')
      .select('id, email, bumper_order_id')
      .eq('email', customerData.email)
      .eq('bumper_order_id', uniqueOrderId)
      .maybeSingle();

    if (existingOrder) {
      logStep("DUPLICATE DETECTED: Multi-warranty order already processed", {
        uniqueOrderId,
        existingEmail: existingOrder.email
      });
      
      // Redirect to success page without processing again
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl
        }
      });
    }

    // Process each warranty item using handle-successful-payment for consistency
    const processedWarranties = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if this specific warranty already exists
      const { data: existingWarranty, error: warrantyCheckError } = await supabaseService
        .from('customers')
        .select('id, registration_plate')
        .eq('email', customerData.email)
        .eq('registration_plate', item.vehicleData.regNumber)
        .maybeSingle();

      if (existingWarranty) {
        logStep(`DUPLICATE DETECTED: Warranty ${i + 1} already exists`, {
          vehicleReg: item.vehicleData.regNumber,
          existingId: existingWarranty.id
        });
        
        processedWarranties.push({
          warrantyNumber: 'DUPLICATE',
          vehicleReg: item.vehicleData.regNumber,
          planName: item.planName,
          totalPrice: item.totalPrice,
          skipped: true
        });
        continue; // Skip to next warranty
      }
      
      logStep(`Processing warranty ${i + 1}`, { 
        planName: item.planName, 
        vehicleReg: item.vehicleData.regNumber,
        totalPrice: item.totalPrice,
        claimLimit: item.claimLimit,
        protectionAddOns: item.protectionAddOns
      });

      try {
        // Use unique order ID for multi-warranty tracking
        const bumperOrderId = `${uniqueOrderId}-${i}`;
        
        // Process this individual warranty using the existing handle-successful-payment function
        const { data: paymentData, error: paymentError } = await supabaseService.functions.invoke('handle-successful-payment', {
          body: {
            planId: item.planName,
            paymentType: item.paymentType || '12months',
            userEmail: customerData.email,
            userId: null,
            bumperOrderId: bumperOrderId, // Use consistent unique ID
            vehicleData: item.vehicleData,
            customerData: {
              ...customerData,
              vehicle_reg: item.vehicleData.regNumber,
              final_amount: item.totalPrice
            },
            // Use the claim limit and voluntary excess from the item
            claimLimit: item.claimLimit ?? 1250,
            voluntaryExcess: item.voluntaryExcess ?? 150,
            // Convert protectionAddOns to metadata format for consistency
            metadata: {
              addon_tyre_cover: item.protectionAddOns?.tyre ? 'true' : 'false',
              addon_wear_tear: item.protectionAddOns?.wearAndTear ? 'true' : 'false',
              addon_europe_cover: item.protectionAddOns?.european ? 'true' : 'false',
              addon_transfer_cover: item.protectionAddOns?.transfer ? 'true' : 'false',
              addon_breakdown_recovery: item.protectionAddOns?.breakdown ? 'true' : 'false',
              addon_vehicle_rental: item.protectionAddOns?.rental ? 'true' : 'false',
              addon_mot_fee: item.protectionAddOns?.motFee ? 'true' : 'false',
              addon_mot_repair: item.protectionAddOns?.motRepair ? 'true' : 'false',
              addon_lost_key: item.protectionAddOns?.lostKey ? 'true' : 'false',
              addon_consequential: item.protectionAddOns?.consequential ? 'true' : 'false'
            }
          }
        });

        if (paymentError) {
          logStep(`Error processing warranty ${i + 1}`, paymentError);
          throw new Error(`Payment processing failed for warranty ${i + 1}: ${paymentError.message}`);
        }

        logStep(`Warranty ${i + 1} processed successfully`, paymentData);

        processedWarranties.push({
          warrantyNumber: paymentData?.policyNumber || `Policy_${i + 1}`,
          vehicleReg: item.vehicleData.regNumber,
          planName: item.planName,
          totalPrice: item.totalPrice,
          customerId: paymentData?.customerId,
          policyId: paymentData?.policyId
        });

        // Send individual welcome email for this specific warranty
        if (paymentData?.customerId && paymentData?.policyId) {
          try {
            logStep(`Sending individual welcome email for warranty ${i + 1}`, { 
              customerId: paymentData.customerId, 
              policyId: paymentData.policyId,
              vehicleReg: item.vehicleData.regNumber,
              planName: item.planName
            });

            const emailPayload = {
              customerId: paymentData.customerId,
              policyId: paymentData.policyId
            };

            // Use the manual welcome email function for this specific warranty
            const { data: emailResult, error: emailError } = await supabaseService.functions.invoke('send-welcome-email-manual', {
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
                vehicleReg: item.vehicleData.regNumber
              });
            } else {
              logStep(`SUCCESS: Welcome email sent for warranty ${i + 1}`, {
                result: emailResult,
                vehicleReg: item.vehicleData.regNumber,
                planName: item.planName
              });
            }

          } catch (emailError) {
            logStep(`Welcome email failed for warranty ${i + 1}`, { 
              error: emailError,
              message: emailError instanceof Error ? emailError.message : String(emailError),
              policyId: paymentData.policyId,
              vehicleReg: item.vehicleData.regNumber
            });
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep(`Failed to process warranty ${i + 1}`, { error: errorMessage });
        // Don't throw here - continue processing other warranties
        processedWarranties.push({
          warrantyNumber: `Error_${i + 1}`,
          vehicleReg: item.vehicleData.regNumber,
          planName: item.planName,
          totalPrice: item.totalPrice,
          error: errorMessage
        });
      }
    }

    logStep("Multi-warranty Bumper success processing completed", { 
      processedCount: processedWarranties.length,
      totalAmount,
      customerEmail: customerData.email
    });

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-multi-warranty-bumper-success", { message: errorMessage });
    
    // Redirect to error page
    const errorRedirect = req.headers.get("origin") || "https://buyawarranty.com";
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${errorRedirect}/payment-fallback?error=processing_failed`
      }
    });
  }
});

async function generateWarrantyNumber(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_warranty_number');
    
    if (error) {
      console.error('Error generating warranty number:', error);
      // Fallback to time-based warranty number
      return `BAW-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
    }
    
    return data;
  } catch (error) {
    console.error('Error calling generate_warranty_number:', error);
    // Fallback to time-based warranty number
    return `BAW-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  }
}

function calculatePolicyEndDate(paymentType: string): string {
  const startDate = new Date();
  
  switch (paymentType) {
    case 'monthly':
      startDate.setMonth(startDate.getMonth() + 1);
      break;
    case 'yearly':
      startDate.setFullYear(startDate.getFullYear() + 1);
      break;
    case 'twoYear':
      startDate.setFullYear(startDate.getFullYear() + 2);
      break;
    case 'threeYear':
      startDate.setFullYear(startDate.getFullYear() + 3);
      break;
    default:
      startDate.setFullYear(startDate.getFullYear() + 1);
  }
  
  return startDate.toISOString();
}