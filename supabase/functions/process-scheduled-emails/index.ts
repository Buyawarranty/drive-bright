import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isMarketingSuppressed, isMarketingTemplate } from "../_shared/marketing-suppression.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SCHEDULED-EMAILS] ${step}${detailsStr}`);
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
    logStep("Starting scheduled email processing");

    // Get all scheduled emails that are due to be sent
    const { data: scheduledEmails, error: fetchError } = await supabaseClient
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process up to 50 emails at a time

    if (fetchError) {
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      logStep("No scheduled emails to process");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No emails to process",
        processedCount: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${scheduledEmails.length} emails to process`);

    let processedCount = 0;
    let failedCount = 0;

    // Process each scheduled email
    for (const scheduledEmail of scheduledEmails) {
      try {
        logStep(`Processing email ${scheduledEmail.id} for ${scheduledEmail.recipient_email}`);

        // Skip marketing/reminder mail for anyone unsubscribed.
        const schedTemplate = scheduledEmail.template_id || scheduledEmail.metadata?.emailType;
        if (isMarketingTemplate(schedTemplate) || scheduledEmail.metadata?.isMarketing === true) {
          if (await isMarketingSuppressed(supabaseClient, scheduledEmail.recipient_email)) {
            logStep(`Skipping ${scheduledEmail.id} — recipient unsubscribed`, { email: scheduledEmail.recipient_email });
            await supabaseClient
              .from('scheduled_emails')
              .update({
                status: 'cancelled',
                metadata: { ...scheduledEmail.metadata, cancelled_reason: 'unsubscribed', cancelled_at: new Date().toISOString() }
              })
              .eq('id', scheduledEmail.id);
            continue;
          }
        }

        // Mark as processing
        await supabaseClient
          .from('scheduled_emails')
          .update({ status: 'processing' })
          .eq('id', scheduledEmail.id);

        // Route based on emailType - claim_info goes to dedicated edge function
        const isClaimInfo = scheduledEmail.metadata?.emailType === 'claim_info';
        const targetFn = isClaimInfo ? 'send-claim-info-email' : 'send-email';
        const targetBody = isClaimInfo ? {
          email: scheduledEmail.recipient_email,
          customerFirstName: scheduledEmail.metadata?.customerFirstName,
        } : {
          templateId: scheduledEmail.template_id,
          recipientEmail: scheduledEmail.recipient_email,
          customerId: scheduledEmail.customer_id,
          variables: scheduledEmail.metadata || {}
        };

        const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke(targetFn, {
          body: targetBody
        });

        if (emailError) {
          throw emailError;
        }

        // Mark as sent
        await supabaseClient
          .from('scheduled_emails')
          .update({ 
            status: 'sent',
            metadata: {
              ...scheduledEmail.metadata,
              sent_at: new Date().toISOString(),
              email_result: emailResult
            }
          })
          .eq('id', scheduledEmail.id);

        processedCount++;
        logStep(`Successfully sent email ${scheduledEmail.id}`);

      } catch (error) {
        logStep(`Failed to send email ${scheduledEmail.id}:`, error);
        
        // Mark as failed
        await supabaseClient
          .from('scheduled_emails')
          .update({ 
            status: 'failed',
            metadata: {
              ...scheduledEmail.metadata,
              failed_at: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error)
            }
          })
          .eq('id', scheduledEmail.id);

        failedCount++;
      }
    }

    logStep(`Processing complete: ${processedCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Scheduled emails processed",
      processedCount,
      failedCount,
      totalFound: scheduledEmails.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-scheduled-emails", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});