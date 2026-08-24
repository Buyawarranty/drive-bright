import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { logCustomerEmail } from '../_shared/log-email.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, subject, html, claimId, registration } = await req.json();

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing to, subject or html" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "BuyaWarranty Claims <claims@buyawarranty.co.uk>",
        to: [to],
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.json();

    await logCustomerEmail({
      recipient_email: to,
      subject,
      template_name: 'claim_appeal',
      source_function: 'send-appeal-email',
      status: emailResponse.ok ? 'sent' : 'failed',
      error_message: emailResponse.ok ? undefined : (emailResult.message || `HTTP ${emailResponse.status}`),
      registration_plate: registration || undefined,
      metadata: { claim_id: claimId, message_id: emailResult.id },
    });

    if (!emailResponse.ok) throw new Error(`Email failed: ${emailResult.message || 'Unknown error'}`);

    return new Response(JSON.stringify({ success: true, id: emailResult.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-appeal-email error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
