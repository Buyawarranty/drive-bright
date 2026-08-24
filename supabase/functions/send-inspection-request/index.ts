import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANIES = ["ACE", "Scotia"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const claimId: string = body.claimId;
    const recipientEmail: string = (body.recipientEmail || "").trim().toLowerCase();
    const company: string = COMPANIES.includes(body.inspectionCompany) ? body.inspectionCompany : "ACE";
    const fee = Number(body.feeAmount) > 0 ? Number(body.feeAmount) : 140;
    const note: string = body.note || "";
    // Appeals only need the payable link (the claims team posts it in the
    // customer's profile), so allow skipping the email.
    const sendEmail: boolean = body.sendEmail !== false;

    if (!claimId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing claimId or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claim, error: claimError } = await supabase
      .from("claims_submissions")
      .select("id, name, email, phone, vehicle_registration, claim_reason")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError || !claim) {
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("claim_inspection_requests")
      .insert({
        claim_id: claim.id,
        customer_name: claim.name,
        customer_email: recipientEmail,
        customer_phone: claim.phone,
        vehicle_registration: claim.vehicle_registration,
        claim_reason: claim.claim_reason,
        inspection_company: company,
        fee_amount: fee,
      })
      .select("id, token")
      .single();

    if (insertError || !inserted) {
      console.error("Insert error", insertError);
      throw new Error(insertError?.message || "Failed to create inspection request");
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";
    const link = `${siteUrl}/independent-inspection/${inserted.token}`;
    const reg = (claim.vehicle_registration || "N/A").toUpperCase();

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Buy a Warranty</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0;">Independent inspection</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Hi ${claim.name || "there"},<br><br>
            We can arrange an independent inspection for your claim on
            <strong>${reg}</strong>. The inspection is carried out by an independent engineer
            and the fee is <strong>£${fee.toFixed(2)}</strong>.
          </p>
          ${note ? `<div style="background:#f0f9ff;border-left:4px solid #1e3a5f;padding:12px 16px;margin:16px 0;color:#374151;font-size:14px;">${note.replace(/\n/g, "<br/>")}</div>` : ""}
          <ul style="color:#374151;font-size:14px;line-height:1.7;padding-left:18px;">
            <li>The inspection is completed by <strong>${company}</strong>, assigned based on availability.</li>
            <li>Inspections take on average <strong>7 to 14 working days</strong>.</li>
            <li>The engineer's decision is <strong>full and final</strong> and binding on both parties.</li>
          </ul>
          <p style="text-align:center;margin:28px 0;">
            <a href="${link}" style="background:#f97316;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
              Complete form &amp; pay £${fee.toFixed(2)}
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px;">This link expires in 30 days. Any questions, call us on 0330 229 5045.</p>
          <p style="color:#1f2937;font-size:14px;margin-top:18px;">
            Kind regards,<br/><strong style="color:#1e3a5f;">Buy a Warranty Claims Team</strong>
          </p>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#64748b;font-size:12px;margin:0;">Buy a Warranty Claims Department · 0330 229 5045 · claims@buyawarranty.co.uk</p>
        </div>
      </div>`;

    if (!sendEmail) {
      return new Response(JSON.stringify({ success: true, id: inserted.id, link, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const subject = `Independent inspection for your claim: ${reg}`;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "BuyaWarranty Claims <claims@buyawarranty.co.uk>",
        to: [recipientEmail],
        subject,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Email failed", emailResult);
      throw new Error(`Email failed: ${emailResult.message}`);
    }

    return new Response(JSON.stringify({ success: true, id: inserted.id, link, emailed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-inspection-request error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
