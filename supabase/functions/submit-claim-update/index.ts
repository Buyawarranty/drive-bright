import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { token, statusUpdate, notes, invoiceNumber, invoiceAmount, estimatedCompletion, fileUrl, fileName, respondentName, respondentEmail } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the request by token
    const { data: request, error: reqError } = await supabase
      .from("claim_update_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(request.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert response
    const { error: insertError } = await supabase
      .from("claim_update_responses")
      .insert({
        request_id: request.id,
        claim_id: request.claim_id,
        status_update: statusUpdate,
        notes,
        invoice_number: invoiceNumber,
        invoice_amount: invoiceAmount ? parseFloat(invoiceAmount) : null,
        estimated_completion: estimatedCompletion,
        file_url: fileUrl,
        file_name: fileName,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save response");
    }

    // Mark request as responded
    await supabase
      .from("claim_update_requests")
      .update({ is_responded: true })
      .eq("id", request.id);

    // Send notification email to claims@buyawarranty.co.uk
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const regPlate = request.vehicle_registration?.toUpperCase() || "N/A";

      const notificationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">✅ Claim Update Received</h1>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <div style="background-color: #FFD700; display: inline-block; padding: 6px 16px; border-radius: 4px; border: 3px solid #000; font-weight: bold; font-size: 22px; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif; margin-bottom: 16px;">
              ${regPlate}
            </div>
            
            <table style="width: 100%; font-size: 14px; margin: 16px 0;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Customer:</td><td style="padding: 6px 0; font-weight: 600;">${request.customer_name || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Claim Reason:</td><td style="padding: 6px 0;">${request.claim_reason || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Status Update:</td><td style="padding: 6px 0; font-weight: 600; color: #059669;">${statusUpdate || 'Not provided'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Notes:</td><td style="padding: 6px 0;">${notes || 'None'}</td></tr>
              ${invoiceNumber ? `<tr><td style="padding: 6px 0; color: #6b7280;">Invoice #:</td><td style="padding: 6px 0;">${invoiceNumber}</td></tr>` : ""}
              ${invoiceAmount ? `<tr><td style="padding: 6px 0; color: #6b7280;">Invoice Amount:</td><td style="padding: 6px 0; font-weight: 600;">£${parseFloat(invoiceAmount).toFixed(2)}</td></tr>` : ""}
              ${estimatedCompletion ? `<tr><td style="padding: 6px 0; color: #6b7280;">Est. Completion:</td><td style="padding: 6px 0;">${estimatedCompletion}</td></tr>` : ""}
              <tr><td style="padding: 6px 0; color: #6b7280;">Responded by:</td><td style="padding: 6px 0;">${respondentName || 'N/A'} (${respondentEmail || 'N/A'})</td></tr>
            </table>
            
            ${fileUrl ? `<p style="margin-top: 12px;"><a href="${fileUrl}" style="color: #1e3a5f; font-weight: 600;">📎 View attached file: ${fileName || 'Download'}</a></p>` : ""}
          </div>
          <div style="background: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">This update was submitted via the claims update portal.</p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BuyaWarranty Claims <claims@buyawarranty.co.uk>",
          to: ["claims@buyawarranty.co.uk"],
          subject: `Claim Update Received: ${regPlate} — ${statusUpdate || "Update submitted"}`,
          html: notificationHtml,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
