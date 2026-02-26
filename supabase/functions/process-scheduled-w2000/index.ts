import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SCHEDULED-W2000] ${step}${detailsStr}`);
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
    logStep("Starting scheduled W2000 processing");

    // Get end of today for comparison (23:59:59.999) so we catch all policies scheduled for today
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayISO = endOfToday.toISOString();

    // Find all policies scheduled for W2000 submission on or before today
    const { data: scheduledPolicies, error: fetchError } = await supabaseClient
      .from('customer_policies')
      .select('id, customer_id, email, warranty_number, warranties_2000_scheduled_for, policy_start_date')
      .eq('warranties_2000_status', 'scheduled')
      .lte('warranties_2000_scheduled_for', endOfTodayISO)
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      throw fetchError;
    }

    if (!scheduledPolicies || scheduledPolicies.length === 0) {
      logStep("No scheduled W2000 submissions to process");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No policies to process",
        processedCount: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${scheduledPolicies.length} policies to process`);

    let successCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    // Process each scheduled policy
    for (const policy of scheduledPolicies) {
      try {
        logStep(`Processing policy ${policy.id}`, { 
          warrantyNumber: policy.warranty_number,
          scheduledFor: policy.warranties_2000_scheduled_for 
        });

        // Mark as processing
        await supabaseClient
          .from('customer_policies')
          .update({ warranties_2000_status: 'processing' })
          .eq('id', policy.id);

        // Call the W2000 function
        const { data: w2kResult, error: w2kError } = await supabaseClient.functions.invoke('send-to-warranties-2000', {
          body: { 
            policyId: policy.id, 
            customerId: policy.customer_id 
          }
        });

        if (w2kError) {
          throw w2kError;
        }

        // Activate the policy now that W2000 submission succeeded and start date has passed
        const startDate = new Date(policy.policy_start_date);
        const now = new Date();
        if (startDate <= now) {
          await supabaseClient
            .from('customer_policies')
            .update({ status: 'active' })
            .eq('id', policy.id);
          logStep(`Activated scheduled policy ${policy.id}`);

          // Send the welcome/activation email now that the warranty is live
          try {
            logStep(`Sending activation welcome email for policy ${policy.id}`);
            const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-welcome-email-manual', {
              body: {
                policyId: policy.id,
                customerId: policy.customer_id,
                forceResend: true
              }
            });

            if (emailError) {
              logStep(`Warning: Failed to send activation email for policy ${policy.id}`, { error: emailError });
            } else {
              logStep(`Activation email sent for policy ${policy.id}`, emailResult);
            }
          } catch (emailErr) {
            // Don't fail the whole activation if email fails
            logStep(`Warning: Email send error for policy ${policy.id}`, { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
          }
        }

        logStep(`Successfully sent policy ${policy.id} to W2000`, w2kResult);
        successCount++;
        results.push({ 
          policyId: policy.id, 
          warrantyNumber: policy.warranty_number, 
          status: 'sent' 
        });

      } catch (error) {
        logStep(`Failed to process policy ${policy.id}`, error);
        
        // Mark as failed
        await supabaseClient
          .from('customer_policies')
          .update({ 
            warranties_2000_status: 'failed',
            warranties_2000_response: {
              error: error instanceof Error ? error.message : String(error),
              failed_at: new Date().toISOString(),
              scheduled_processing: true
            }
          })
          .eq('id', policy.id);

        failedCount++;
        results.push({ 
          policyId: policy.id, 
          warrantyNumber: policy.warranty_number, 
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logStep(`Processing complete: ${successCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Scheduled W2000 processing complete",
      processedCount: successCount,
      failedCount,
      totalFound: scheduledPolicies.length,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-scheduled-w2000", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
