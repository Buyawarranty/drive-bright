import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketingEmailRequest {
  campaignId?: string;
  emails: string[];
  subject: string;
  content: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Marketing email request received");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    const { campaignId, emails, subject, content }: MarketingEmailRequest = await req.json();

    console.log(`Sending marketing email to ${emails.length} recipients`);
    console.log(`Subject: ${subject}`);

    if (!emails || emails.length === 0) {
      throw new Error("No email addresses provided");
    }

    // Filter out unsubscribed/blocked emails
    const { data: blockedEmails } = await supabaseClient
      .from('email_unsubscribes')
      .select('email')
      .in('email', emails.map((e: string) => e.trim().toLowerCase()));

    const blockedSet = new Set((blockedEmails || []).map((b: any) => b.email));
    const filteredEmails = emails.filter((e: string) => !blockedSet.has(e.trim().toLowerCase()));
    
    if (blockedSet.size > 0) {
      console.log(`Filtered out ${blockedSet.size} blocked/unsubscribed emails`);
    }

    if (filteredEmails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All recipients are unsubscribed/blocked",
        stats: { total_emails: emails.length, blocked_emails: blockedSet.size, successful_emails: 0, failed_emails: 0 }
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!subject || !content) {
      throw new Error("Subject and content are required");
    }

    // Convert content to HTML format (basic line breaks)
    const htmlContent = content.replace(/\n/g, '<br>');

    // Send emails individually for personalized unsubscribe links
    const results = [];
    const batchSize = 10; // Process in smaller batches with delays

    for (let i = 0; i < filteredEmails.length; i += batchSize) {
      const batch = filteredEmails.slice(i, i + batchSize);
      
      console.log(`Sending batch ${Math.floor(i/batchSize) + 1}: ${batch.length} emails`);
      
      try {
        // Log each email before sending
        const emailLogsPromises = batch.map(email => 
          supabaseClient.from('email_logs').insert({
            campaign_id: campaignId || null,
            recipient_email: email,
            subject: subject,
            content: content,
            delivery_status: 'sent',
            sent_at: new Date().toISOString()
          })
        );
        
        await Promise.all(emailLogsPromises);

        // Send individually so each recipient gets their own unsubscribe link
        const sendPromises = batch.map(async (recipientEmail: string) => {
          const cleanEmail = recipientEmail.trim().toLowerCase();
          const unsubToken = btoa(cleanEmail + '_baw_unsub_2024');
          const unsubUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(unsubToken)}`;
          
          return resend.emails.send({
            from: "Buyawarranty Customer Care <marketing@buyawarranty.co.uk>",
            to: [recipientEmail],
            subject: subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="margin-bottom: 30px;">${htmlContent}</div>
                
                <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #666; font-size: 12px;">
                  <p>You're receiving this email because you've interacted with Buy A Warranty.</p>
                  <p>Buy A Warranty Ltd - Your trusted warranty provider</p>
                  <p style="margin-top: 12px;">
                    <a href="${unsubUrl}" style="color: #999; text-decoration: underline; font-size: 11px;">Unsubscribe</a> from future emails.
                  </p>
                </div>
              </div>
            `,
          });
        });

        const batchResults = await Promise.all(sendPromises);

        results.push({
          batch: Math.floor(i/batchSize) + 1,
          success: true,
          count: batch.length,
          response: batchResults
        });

        console.log(`Batch ${Math.floor(i/batchSize) + 1} sent successfully`);

        // Update email logs with delivery confirmation
        await Promise.all(
          batch.map(email =>
            supabaseClient.from('email_logs')
              .update({ delivery_status: 'delivered' })
              .eq('recipient_email', email)
              .eq('sent_at', new Date().toISOString())
          )
        );
        
      } catch (batchError) {
        const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
        console.error(`Error sending batch ${Math.floor(i/batchSize) + 1}:`, batchError);
        results.push({
          batch: Math.floor(i/batchSize) + 1,
          success: false,
          count: batch.length,
          error: errorMessage
        });
      }

      // Add a small delay between batches to be respectful of rate limits
      if (i + batchSize < filteredEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successfulBatches = results.filter(r => r.success).length;
    const totalSuccessful = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);

    console.log(`Marketing email campaign completed: ${successfulBatches}/${results.length} batches successful, ${totalSuccessful}/${filteredEmails.length} emails sent (${blockedSet.size} blocked)`);

    // Update campaign status if campaignId provided
    if (campaignId) {
      await supabaseClient
        .from('email_campaigns')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Update campaign analytics
      await supabaseClient.rpc('update_campaign_analytics', { 
        p_campaign_id: campaignId 
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Marketing email sent successfully`,
      stats: {
        total_emails: emails.length,
        successful_emails: totalSuccessful,
        failed_emails: emails.length - totalSuccessful,
        batches_sent: successfulBatches,
        total_batches: results.length
      },
      results: results
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-marketing-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        message: "Failed to send marketing email"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);