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

    if (!subject || !content) {
      throw new Error("Subject and content are required");
    }

    // Convert content to HTML format (basic line breaks)
    const htmlContent = content.replace(/\n/g, '<br>');

    // Send emails in batches to avoid rate limiting
    const batchSize = 50; // Resend allows up to 50 recipients per request
    const results = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
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

        const emailResponse = await resend.emails.send({
          from: "Marketing <marketing@buyawarranty.co.uk>",
          to: batch,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="margin-bottom: 30px;">${htmlContent}</div>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #666; font-size: 12px;">
                <p>You're receiving this email because you've interacted with Buy A Warranty.</p>
                <p>If you no longer wish to receive marketing emails, please contact us.</p>
                <p>Buy A Warranty Ltd - Your trusted warranty provider</p>
              </div>
            </div>
          `,
        });

        results.push({
          batch: Math.floor(i/batchSize) + 1,
          success: true,
          count: batch.length,
          response: emailResponse
        });

        console.log(`Batch ${Math.floor(i/batchSize) + 1} sent successfully:`, emailResponse);

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
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successfulBatches = results.filter(r => r.success).length;
    const totalSuccessful = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);

    console.log(`Marketing email campaign completed: ${successfulBatches}/${results.length} batches successful, ${totalSuccessful}/${emails.length} emails sent`);

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