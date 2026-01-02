import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimEmailRequest {
  to: string;
  subject: string;
  body: string;
  claimId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, claimId } = await req.json() as ClaimEmailRequest;

    console.log("Sending claim email:", { to, subject, claimId });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BuyaWarranty Team <claims@buyawarranty.co.uk>",
        to: [to],
        subject: subject,
        text: body,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Buy a Warranty</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">Claims Department</p>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.6; color: #374151;">${body}</pre>
            </div>
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This email was sent from the Buy a Warranty admin portal.<br>
                Claim Reference: ${claimId.slice(0, 8)}
              </p>
            </div>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email send result:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${emailResult.message || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: emailResult.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending claim email:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
