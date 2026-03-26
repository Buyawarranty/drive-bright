import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[FLAG-QUOTE-DETAILS] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId, customerName, customerEmail, vehicleReg, issueMessage } = await req.json();

    logStep("Received flag request", { quoteId, customerName, vehicleReg });

    if (!quoteId || !vehicleReg) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1. Insert into quote_detail_issues table
    const { error: insertError } = await supabaseClient
      .from("quote_detail_issues")
      .insert({
        quote_id: quoteId,
        customer_name: customerName || "Unknown",
        customer_email: customerEmail || "",
        vehicle_reg: vehicleReg || "",
        issue_message: issueMessage || "Customer flagged details as incorrect",
        status: "open",
      });

    if (insertError) {
      logStep("Error inserting detail issue", { error: insertError.message });
      throw new Error(insertError.message);
    }

    logStep("Detail issue recorded in database");

    // 2. Send email to support@buyawarranty.co.uk
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const regPlate = (vehicleReg || "UNKNOWN").toUpperCase();
      const subject = `URGENT ${regPlate}: Customer details incorrect`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">⚠️ URGENT: Customer Details Flagged as Incorrect</h1>
          </div>
          <div style="background: #fef2f2; padding: 24px; border: 1px solid #fecaca;">
            <div style="background: #fef9c3; border: 2px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">
                🚗 REG PLATE: ${regPlate}
              </p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Customer Name:</td>
                <td style="padding: 8px 0; color: #111827;">${customerName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
                <td style="padding: 8px 0; color: #111827;">${customerEmail || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Issue Reported:</td>
                <td style="padding: 8px 0; color: #111827;">${issueMessage || 'Details flagged as incorrect'}</td>
              </tr>
            </table>
            <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #dc2626; font-weight: bold;">
                ⚡ Action Required: Please review and correct the warranty details before completing this order.
              </p>
            </div>
          </div>
          <div style="padding: 16px 24px; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: 0;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              This is an automated alert from BuyAWarranty. Log in to the admin dashboard to resolve this issue.
            </p>
          </div>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "BuyAWarranty Alerts <alerts@notify.buyawarranty.co.uk>",
          to: ["support@buyawarranty.co.uk"],
          subject,
          html: htmlContent,
        });
        logStep("Alert email sent to support@buyawarranty.co.uk");
      } catch (emailError) {
        logStep("Failed to send email (non-blocking)", { error: String(emailError) });
      }
    } else {
      logStep("RESEND_API_KEY not set, skipping email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("Error", { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
