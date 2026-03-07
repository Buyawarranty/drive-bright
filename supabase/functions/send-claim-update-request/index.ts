import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  claimIds: string[];
  recipientEmail: string;
  message?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { claimIds, recipientEmail, message } = await req.json() as RequestBody;

    if (!claimIds?.length || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch claims
    const { data: claims, error: claimsError } = await supabase
      .from("claims_submissions")
      .select("id, name, vehicle_registration, claim_reason")
      .in("id", claimIds);

    if (claimsError || !claims?.length) {
      return new Response(JSON.stringify({ error: "Claims not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create update requests for each claim
    const requests = claims.map((claim) => ({
      claim_id: claim.id,
      recipient_email: recipientEmail,
      vehicle_registration: claim.vehicle_registration,
      claim_reason: claim.claim_reason,
      customer_name: claim.name,
    }));

    const { data: insertedRequests, error: insertError } = await supabase
      .from("claim_update_requests")
      .insert(requests)
      .select("id, token, vehicle_registration, claim_reason, customer_name");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to create update requests");
    }

    // Build the reg plates for the subject line
    const regPlates = claims
      .map((c) => c.vehicle_registration?.toUpperCase())
      .filter(Boolean)
      .join(", ");

    const firstRegPlate = claims[0]?.vehicle_registration?.toUpperCase() || "N/A";

    // Build the site URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";

    // Build form links for each claim
    const claimLinks = insertedRequests!.map((r) => {
      const reg = r.vehicle_registration?.toUpperCase() || "N/A";
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
            <div style="background-color: #FFD700; display: inline-block; padding: 4px 12px; border-radius: 4px; border: 2px solid #000; font-weight: bold; font-size: 16px; letter-spacing: 1px; font-family: 'Arial Black', Arial, sans-serif;">
              ${reg}
            </div>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${r.customer_name || 'N/A'}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${r.claim_reason || 'N/A'}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
            <a href="${siteUrl}/claim-update/${r.token}" style="background: #1e3a5f; color: white; padding: 8px 20px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">
              Update Claim
            </a>
          </td>
        </tr>`;
    }).join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Buy a Warranty</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0;">Claims Update Request</p>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Hi,<br><br>
            We require an update on the following warranty claim(s). Please click the button next to each claim to provide your update, including any invoice details or supporting documents.
          </p>
          
          ${message ? `<div style="background: #f0f9ff; border-left: 4px solid #1e3a5f; padding: 12px 16px; margin: 16px 0; color: #374151; font-size: 14px;"><strong>Note:</strong> ${message}</div>` : ""}
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 10px 16px; text-align: left; border-bottom: 2px solid #e2e8f0;">Reg Plate</th>
                <th style="padding: 10px 16px; text-align: left; border-bottom: 2px solid #e2e8f0;">Customer</th>
                <th style="padding: 10px 16px; text-align: left; border-bottom: 2px solid #e2e8f0;">Claim Reason</th>
                <th style="padding: 10px 16px; text-align: left; border-bottom: 2px solid #e2e8f0;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${claimLinks}
            </tbody>
          </table>
          
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            These links will expire in 30 days. If you have any questions, please reply to this email.
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Buy a Warranty Claims Department<br>
            This is an automated request for claim updates.
          </p>
        </div>
      </div>
    `;

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BuyaWarranty Claims <claims@buyawarranty.co.uk>",
        to: [recipientEmail],
        subject: `Urgent claims update: ${firstRegPlate}${claims.length > 1 ? ` (+${claims.length - 1} more)` : ""}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Email failed:", emailResult);
      throw new Error(`Email failed: ${emailResult.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, requestCount: insertedRequests!.length }),
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
