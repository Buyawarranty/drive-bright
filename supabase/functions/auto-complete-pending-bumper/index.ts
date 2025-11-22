import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-COMPLETE-PENDING-BUMPER] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting auto-completion of pending Bumper transactions");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // CRITICAL: DO NOT auto-complete pending transactions!
    // Only Bumper's success callback should create warranties after payment is confirmed.
    // Auto-completing pending transactions creates warranties for unpaid orders.
    // 
    // This function is now disabled to prevent premature warranty creation.
    // If needed in future, it should verify payment with Bumper API before completing.
    
    logStep("Auto-complete function is DISABLED - pending transactions will NOT be auto-completed");
    
    return new Response(JSON.stringify({
      success: true,
      message: "Auto-complete is disabled - only confirmed payments create warranties",
      processed: 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
    // OLD CODE (DISABLED):
    // Find pending transactions older than 5 minutes
    // This gives Bumper enough time to call the webhook normally
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: pendingTransactions, error: fetchError } = await supabaseClient
      .from('bumper_transactions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(20); // Process max 20 at a time to avoid timeout

    if (fetchError) {
      logStep("Error fetching pending transactions", { error: fetchError.message });
      throw new Error(`Failed to fetch pending transactions: ${fetchError.message}`);
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      logStep("No pending transactions found to process");
      return new Response(JSON.stringify({
        success: true,
        message: "No pending transactions to process",
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    logStep(`Found ${pendingTransactions.length} pending transactions to process`);

    const results = [];
    
    for (const transaction of pendingTransactions) {
      const transactionId = transaction.transaction_id;
      
      try {
        logStep(`Processing transaction ${transactionId}`, {
          email: transaction.customer_data?.email,
          age: Math.floor((Date.now() - new Date(transaction.created_at).getTime()) / 60000) + ' minutes'
        });

        // Check if customer already exists with this bumper_order_id to prevent duplicates
        const { data: existingCustomer } = await supabaseClient
          .from('customers')
          .select('id, email')
          .eq('bumper_order_id', transactionId)
          .maybeSingle();

        if (existingCustomer) {
          logStep(`Customer already exists for transaction ${transactionId}, marking as completed`);
          
          // Update transaction status to completed
          await supabaseClient
            .from('bumper_transactions')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('transaction_id', transactionId);
          
          results.push({
            transactionId,
            status: 'already_processed',
            email: existingCustomer.email
          });
          continue;
        }

        // Update transaction status to completed to prevent race conditions
        const { data: updatedTransaction, error: updateError } = await supabaseClient
          .from('bumper_transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('transaction_id', transactionId)
          .eq('status', 'pending')
          .select();

        if (updateError || !updatedTransaction || updatedTransaction.length === 0) {
          logStep(`Transaction ${transactionId} already being processed or update failed`);
          results.push({
            transactionId,
            status: 'skipped',
            reason: 'already_processing',
            email: transaction.customer_data?.email
          });
          continue;
        }

        // Extract data from transaction
        const customerData = transaction.customer_data;
        const vehicleData = transaction.vehicle_data;
        const protectionAddOns = transaction.protection_addons || {};
        const planId = transaction.plan_id;
        const paymentType = transaction.payment_type || '12months';
        const finalAmount = transaction.final_amount;
        const discountCode = transaction.discount_code;

        // Convert protection add-ons to database field format
        const addOnFields = {
          breakdown_recovery: protectionAddOns.breakdown || false,
          mot_fee: protectionAddOns.motFee || false,
          tyre_cover: protectionAddOns.tyre || false,
          wear_tear: protectionAddOns.wearAndTear || false,
          europe_cover: protectionAddOns.european || false,
          transfer_cover: protectionAddOns.transfer || false,
          vehicle_rental: protectionAddOns.rental || false,
          mot_repair: protectionAddOns.motRepair || false,
          lost_key: protectionAddOns.lostKey || false,
          consequential: protectionAddOns.consequential || false
        };

        // Auto-include add-ons based on payment type
        if (paymentType.includes('24') || paymentType.includes('2')) {
          addOnFields.breakdown_recovery = true;
          addOnFields.mot_fee = true;
        } else if (paymentType.includes('36') || paymentType.includes('3')) {
          addOnFields.breakdown_recovery = true;
          addOnFields.mot_fee = true;
          addOnFields.vehicle_rental = true;
          addOnFields.tyre_cover = true;
        }

        const claimLimit = transaction.claim_limit || 1250;
        const voluntaryExcess = protectionAddOns?.voluntaryExcess ?? 0;

        // Call handle-successful-payment
        const handlePaymentPayload = {
          planId,
          customerData: {
            ...customerData,
            bumper_order_id: transactionId
          },
          vehicleData,
          paymentType,
          userEmail: customerData?.email,
          protectionAddOns: addOnFields,
          claimLimit,
          voluntaryExcess,
          skipEmail: false,
          metadata: {
            source: 'bumper_auto',
            transaction_id: transactionId,
            bumper_order_id: transactionId,
            discount_code: discountCode,
            claim_limit: claimLimit,
            voluntary_excess: voluntaryExcess,
            final_amount: finalAmount,
            vehicle_reg: vehicleData?.regNumber || vehicleData?.registration,
            vehicle_make: vehicleData?.make,
            vehicle_model: vehicleData?.model,
            vehicle_year: vehicleData?.year,
          }
        };

        const { data: paymentResult, error: paymentError } = await supabaseClient.functions.invoke(
          'handle-successful-payment',
          { body: handlePaymentPayload }
        );

        if (paymentError) {
          logStep(`Error processing payment for ${transactionId}`, { error: paymentError.message });
          
          // Revert status back to pending for retry
          await supabaseClient
            .from('bumper_transactions')
            .update({ status: 'pending' })
            .eq('transaction_id', transactionId);
          
          results.push({
            transactionId,
            status: 'error',
            error: paymentError.message,
            email: transaction.customer_data?.email
          });
          continue;
        }

        logStep(`Successfully processed transaction ${transactionId}`, {
          policyNumber: paymentResult?.policyNumber
        });
        
        results.push({
          transactionId,
          status: 'success',
          email: transaction.customer_data?.email,
          policyNumber: paymentResult?.policyNumber
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep(`Exception processing transaction ${transactionId}`, { error: errorMessage });
        
        results.push({
          transactionId,
          status: 'error',
          error: errorMessage,
          email: transaction.customer_data?.email
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success' || r.status === 'already_processed').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logStep("Auto-completion finished", {
      total: pendingTransactions.length,
      success: successCount,
      errors: errorCount
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${pendingTransactions.length} pending transactions`,
      summary: {
        total: pendingTransactions.length,
        successful: successCount,
        errors: errorCount
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in auto-complete-pending-bumper", { error: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
