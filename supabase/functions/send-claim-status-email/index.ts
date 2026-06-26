import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCustomerEmail } from "../_shared/log-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[SEND-CLAIM-STATUS-EMAIL] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

// status -> customer-facing copy
const STATUS_COPY: Record<string, { subject: string; heading: string; body: string; tone?: string }> = {
  new: {
    subject: "We've received your claim",
    heading: "Your claim has been received",
    body: "Thanks for submitting your claim. Our team will review the details and be in touch shortly.",
  },
  triage: {
    subject: "Your claim is being triaged",
    heading: "Your claim is being triaged",
    body: "We're doing an initial review of your claim and will move it on to a handler shortly.",
  },
  awaiting_info: {
    subject: "We need more information for your claim",
    heading: "More information needed",
    body: "To progress your claim we need some additional information. A member of our claims team will be in touch with what's required, or you can reply to this email.",
  },
  evidence_received: {
    subject: "Evidence received — your claim is moving forward",
    heading: "Thanks — we've got your evidence",
    body: "We've received the information you sent. Your claim is now being reviewed by our claims team.",
  },
  in_review: {
    subject: "Your claim is now under review",
    heading: "Your claim is under review",
    body: "Our claims team is reviewing your claim. We'll update you as soon as a decision has been made.",
  },
  awaiting_authorisation: {
    subject: "Your claim is awaiting authorisation",
    heading: "Awaiting authorisation",
    body: "Your claim has been reviewed and is now awaiting final authorisation. We'll let you know as soon as it's confirmed.",
  },
  approved: {
    subject: "Good news — your claim has been approved",
    heading: "Your claim has been approved",
    body: "Your claim has been approved and the repair is authorised. Please ask the garage to send the final invoice to claims@buyawarranty.co.uk so we can arrange payment.",
  },
  invoice_received: {
    subject: "Invoice received — being checked",
    heading: "Invoice received",
    body: "We've received the invoice for your repair and are checking it. We'll release payment shortly.",
  },
  payment_pending: {
    subject: "Payment in progress for your claim",
    heading: "Payment in progress",
    body: "Payment for your approved claim is now being processed. You'll receive confirmation once it's been released.",
  },
  paid: {
    subject: "Your claim payment has been issued",
    heading: "Payment issued",
    body: "Payment for your claim has been issued. Please allow a short time for the funds to clear.",
  },
  declined: {
    subject: "Update on your claim",
    heading: "Your claim has been declined",
    body: "After review, your claim has been declined. A member of the claims team will be in touch with the reason and your options, including how to appeal.",
  },
  rejected: {
    subject: "Update on your claim",
    heading: "Your claim has been declined",
    body: "After review, your claim has been declined. A member of the claims team will be in touch with the reason and your options, including how to appeal.",
  },
  appealed: {
    subject: "Your appeal has been received",
    heading: "Appeal received",
    body: "We've logged your appeal and your claim will be re-reviewed. We'll be in touch with an outcome shortly.",
  },
  cancelled: {
    subject: "Your claim has been cancelled",
    heading: "Claim cancelled",
    body: "Your claim has been cancelled. If this wasn't expected, please reply to this email and we'll look into it.",
  },
  closed: {
    subject: "Your claim has been closed",
    heading: "Claim closed",
    body: "Your claim has now been closed. Thanks for using Buy a Warranty — if you need anything else, just reply to this email.",
  },
  overdue: {
    subject: "Update on your claim",
    heading: "Your claim needs attention",
    body: "Your claim has been flagged for urgent follow-up. A member of our claims team will be in touch shortly.",
  },
};

const renderHtml = (firstName: string, copy: typeof STATUS_COPY[string], ref: string) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${copy.subject}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="padding:30px 15px;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="text-align:center;padding:10px 0 20px;">
        <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" style="max-width:200px;height:auto;"/>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:30px;">
        <h1 style="color:#1d3a8a;font-size:22px;margin:0 0 10px 0;">${copy.heading}</h1>
        <p style="font-size:15px;margin:0 0 6px 0;">Hi ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:10px 0 0 0;color:#4b5563;">${copy.body}</p>
        <p style="font-size:14px;line-height:1.6;margin:18px 0 0 0;color:#6b7280;">Claim reference: <strong>${ref}</strong></p>
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #f3f4f6;font-size:13px;color:#6b7280;">
          Questions? Just reply to this email or call us on 0330 229 5040.
        </div>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Buy a Warranty Claims Team</p>
    </div>
  </div>
</body></html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { claimId, status } = await req.json();
    if (!claimId || !status) {
      return new Response(JSON.stringify({ error: "claimId and status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = String(status).toLowerCase();
    const copy = STATUS_COPY[key];
    if (!copy) {
      log("No copy for status, skipping", { status });
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: claim, error } = await supabase
      .from("claims_submissions")
      .select("id,email,name,vehicle_registration")
      .eq("id", claimId)
      .maybeSingle();

    if (error || !claim) {
      log("Claim not found", { claimId, error: error?.message });
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!claim.email) {
      log("Claim has no email, skipping");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const firstName = (claim.name || "there").split(" ")[0];
    const ref = (claim.vehicle_registration || claim.id.slice(0, 8)).toUpperCase();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");

    const payload = {
      from: "Buy a Warranty Claims <claims@buyawarranty.co.uk>",
      to: [claim.email],
      reply_to: "claims@buyawarranty.co.uk",
      subject: copy.subject,
      headers: { "X-Entity-Ref-ID": `claim-status-${claim.id}-${key}-${Date.now()}` },
      html: renderHtml(firstName, copy, ref),
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    await logCustomerEmail({
      recipient_email: claim.email,
      recipient_name: firstName,
      subject: payload.subject,
      template_name: `claim_status_${key}`,
      source_function: "send-claim-status-email",
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? undefined : (result?.message || `HTTP ${res.status}`),
      metadata: { resend_message_id: result?.id, claim_id: claim.id, status: key },
    });

    if (!res.ok) throw new Error(result?.message || `Resend ${res.status}`);

    log("Sent", { id: result.id, status: key });
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
