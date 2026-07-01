import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCustomerEmail } from "../_shared/log-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[SEND-CLAIM-STATUS-EMAIL] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

// Standard reusable blocks (per updated templates)
const HOURS_LINE = "Claims team opening hours: Monday to Friday, 9:00am to 5:30pm, excluding bank holidays. Claims submitted outside these hours will be reviewed on the next working day.";
const TIMEFRAME_LINE = "We aim to review and respond to claims within 1–2 working days. If we need further information from you, your garage, or repairer, this may affect the time it takes to confirm the next steps.";
const REPAIRS_WARNING = "Please do not authorise, start, or pay for any repair work until your claim has been reviewed and approved by our claims team. Repairs carried out without prior written authorisation may not be covered.";
const DIAGNOSTICS_LINE = "Where diagnostics are approved as part of your claim, diagnostic costs are reimbursed up to £50 or one hour of diagnostic labour, whichever is lower, in line with your warranty plan and terms and conditions.";
const APPROVAL_LINE = "If your claim is approved, we'll confirm the authorised amount and explain the next steps for repair or payment, in line with your warranty plan and terms and conditions.";
const CANCELLATION_LINE = "Once claim-related costs have been incurred under your policy, the policy cannot be cancelled and will no longer be eligible for a refund. This helps ensure claims are handled fairly and consistently for all customers.";

// status -> customer-facing copy. `body` is the full plain-text body (newline-separated paragraphs)
// that gets rendered into the branded HTML wrapper. Editing this text in the admin dialog
// updates the email exactly.
const STATUS_COPY: Record<string, { subject: (reg: string) => string; heading: string; body: string }> = {
  new: {
    subject: (reg) => `We've received your claim: ${reg}`,
    heading: "We've received your claim",
    body: [
      "Thank you — we've received your claim and our claims team will now review the information and supporting evidence you have provided.",
      TIMEFRAME_LINE,
      "What happens next:\n1. We review your claim — our claims team will assess the claim details and supporting evidence provided.\n2. We contact you if anything else is needed — if further evidence, clarification, or garage information is required, we'll let you know.\n3. We confirm the next steps — " + APPROVAL_LINE,
      REPAIRS_WARNING,
      DIAGNOSTICS_LINE,
      CANCELLATION_LINE,
      HOURS_LINE,
      "Thank you for your patience — we're here to help and will keep you updated as your claim progresses.",
    ].join("\n\n"),
  },
  triage: {
    subject: (reg) => `Your claim is being triaged: ${reg}`,
    heading: "Your claim is being triaged",
    body: [
      "We're doing an initial review of your claim and will move it on to a handler shortly.",
      TIMEFRAME_LINE,
      REPAIRS_WARNING,
    ].join("\n\n"),
  },
  awaiting_info: {
    subject: (reg) => `Further evidence needed for your claim: ${reg}`,
    heading: "Further evidence needed",
    body: [
      "Thank you for submitting your claim. To continue reviewing it, we need some further information from you.",
      "This may include, where applicable:\n• A diagnostic report\n• A repair estimate or quotation\n• A garage invoice\n• Photos of the issue\n• Fault codes\n• Garage notes or technician comments\n• Vehicle service history\n• Proof of mileage\n• Any other documents requested by our claims team",
      "You can upload the requested evidence using the link in your previous emails, or reply to this email with the documents attached.",
      REPAIRS_WARNING,
      DIAGNOSTICS_LINE,
      "Once we receive the requested evidence, our claims team will continue reviewing your claim. We aim to review and respond within 1–2 working days of receiving the required information.",
    ].join("\n\n"),
  },
  evidence_received: {
    subject: (reg) => `Additional evidence received: ${reg}`,
    heading: "Thanks — we've got your evidence",
    body: [
      "Thank you — we've received your additional evidence and added it to your existing claim.",
      "Our claims team will review the new information alongside your claim details. " + TIMEFRAME_LINE,
      "If we need anything further from you, your garage, or repairer, we'll contact you.",
      REPAIRS_WARNING,
    ].join("\n\n"),
  },
  in_review: {
    subject: (reg) => `Your claim is now under review: ${reg}`,
    heading: "Your claim is under review",
    body: [
      "Our claims team is now reviewing your claim. We'll update you as soon as a decision has been made.",
      TIMEFRAME_LINE,
      REPAIRS_WARNING,
      DIAGNOSTICS_LINE,
    ].join("\n\n"),
  },
  awaiting_authorisation: {
    subject: (reg) => `Your claim is awaiting authorisation: ${reg}`,
    heading: "Awaiting authorisation",
    body: [
      "Your claim has been reviewed and is now awaiting final authorisation. We'll let you know as soon as it's confirmed.",
      APPROVAL_LINE,
      REPAIRS_WARNING,
    ].join("\n\n"),
  },
  approved: {
    subject: (reg) => `Good news — your claim has been approved: ${reg}`,
    heading: "Your claim has been approved",
    body: [
      "Your claim has been approved and the repair is authorised.",
      APPROVAL_LINE,
      "Please ask the garage to send the final invoice to claims@buyawarranty.co.uk so we can arrange payment.",
      DIAGNOSTICS_LINE,
      CANCELLATION_LINE,
    ].join("\n\n"),
  },
  invoice_received: {
    subject: (reg) => `Invoice received — being checked: ${reg}`,
    heading: "Invoice received",
    body: [
      "We've received the invoice for your repair and are checking it. We'll release payment shortly.",
      TIMEFRAME_LINE,
    ].join("\n\n"),
  },
  payment_pending: {
    subject: (reg) => `Payment in progress for your claim: ${reg}`,
    heading: "Payment in progress",
    body: [
      "Payment for your approved claim is now being processed. You'll receive confirmation once it's been released.",
    ].join("\n\n"),
  },
  paid: {
    subject: (reg) => `Your claim payment has been issued: ${reg}`,
    heading: "Payment issued",
    body: [
      "Payment for your claim has been issued. Please allow a short time for the funds to clear.",
      CANCELLATION_LINE,
    ].join("\n\n"),
  },
  declined: {
    subject: (reg) => `Update on your claim: ${reg}`,
    heading: "Your claim has been declined",
    body: [
      "After review, your claim has been declined. A member of the claims team will be in touch with the reason and your options, including how to appeal.",
      CANCELLATION_LINE,
    ].join("\n\n"),
  },
  rejected: {
    subject: (reg) => `Update on your claim: ${reg}`,
    heading: "Your claim has been declined",
    body: [
      "After review, your claim has been declined. A member of the claims team will be in touch with the reason and your options, including how to appeal.",
      CANCELLATION_LINE,
    ].join("\n\n"),
  },
  appealed: {
    subject: (reg) => `Your appeal has been received: ${reg}`,
    heading: "Appeal received",
    body: [
      "We've logged your appeal and your claim will be re-reviewed. We'll be in touch with an outcome shortly.",
      TIMEFRAME_LINE,
    ].join("\n\n"),
  },
  cancelled: {
    subject: (reg) => `Your claim has been cancelled: ${reg}`,
    heading: "Claim cancelled",
    body: [
      "Your claim has been cancelled. If this wasn't expected, please reply to this email and we'll look into it.",
    ].join("\n\n"),
  },
  closed: {
    subject: (reg) => `Your claim has been closed: ${reg}`,
    heading: "Claim closed",
    body: [
      "Your claim has now been closed. Thanks for using Buy a Warranty — if you need anything else, just reply to this email.",
    ].join("\n\n"),
  },
  overdue: {
    subject: (reg) => `Update on your claim: ${reg}`,
    heading: "Your claim needs attention",
    body: [
      "Your claim has been flagged for urgent follow-up. A member of our claims team will be in touch shortly.",
    ].join("\n\n"),
  },
};

function normalizeStatus(status: unknown): string {
  const raw = String(status || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    evidence: "awaiting_info",
    evidence_needed: "awaiting_info",
    evidence_required: "awaiting_info",
    further_evidence: "awaiting_info",
    awaiting_information: "awaiting_info",
    needs_more_info: "awaiting_info",
    need_more_info: "awaiting_info",
    information_required: "awaiting_info",
    under_review: "in_review",
    review: "in_review",
    in_progress: "in_review",
    approved_awaiting_invoice: "approved",
    approve: "approved",
    reject: "declined",
    rejected: "declined",
  };
  return aliases[raw] || raw;
}

// Convert plain-text body (with paragraph breaks and bullets) into safe HTML paragraphs.
function bodyToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\n+/)
    .map((para) => {
      const safe = esc(para).replace(/\n/g, "<br/>");
      return `<p style="font-size:15px;line-height:1.6;margin:0 0 14px 0;color:#374151;">${safe}</p>`;
    })
    .join("");
}

const LOGO_URL = "https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png";
const CLAIMS_PHONE = "0330 229 5045";
const CLAIMS_EMAIL = "claims@buyawarranty.co.uk";

const renderHtml = (firstName: string, heading: string, body: string, ref: string, preheader?: string) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="color-scheme" content="light"/><title>${heading}</title>
<style>
  @media only screen and (max-width:600px){
    .baw-container{width:100%!important;border-radius:0!important;}
    .baw-pad{padding:22px 20px!important;}
    .baw-h1{font-size:20px!important;line-height:1.3!important;}
    .baw-sig-row{display:block!important;}
    .baw-sig-btn{display:inline-block!important;margin:6px 6px 0 0!important;}
    .baw-hero{padding:18px 20px!important;}
    .baw-logo{height:34px!important;}
  }
  a{color:#1d3a8a;}
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#eef1f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  <div style="padding:28px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="baw-container" style="width:620px;max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,0.08);">
      <tr>
        <td class="baw-hero" style="background:linear-gradient(135deg,#1d3a8a 0%,#2751b5 100%);padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="vertical-align:middle;">
                <img src="${LOGO_URL}" alt="Buy a Warranty" class="baw-logo" width="150" style="display:block;height:38px;width:auto;filter:brightness(0) invert(1);"/>
              </td>
              <td align="right" style="vertical-align:middle;color:#dbe4ff;font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;">
                Claims Update
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="baw-pad" style="padding:32px 36px 8px 36px;">
          <h1 class="baw-h1" style="color:#0f172a;font-size:24px;line-height:1.25;margin:0 0 6px 0;font-weight:700;letter-spacing:-0.2px;">${heading}</h1>
          <p style="font-size:13px;color:#64748b;margin:0 0 20px 0;">Claim reference <strong style="color:#1d3a8a;">${ref}</strong></p>
          <p style="font-size:15.5px;line-height:1.6;margin:0 0 16px 0;color:#1f2937;">Hi ${firstName},</p>
          ${bodyToHtml(body)}
        </td>
      </tr>
      <tr>
        <td class="baw-pad" style="padding:12px 36px 28px 36px;">
          <div style="margin-top:6px;padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #1d3a8a;border-radius:8px;">
            <p style="margin:0 0 10px 0;font-size:14px;color:#334155;line-height:1.5;">
              Need to speak to us about this claim? Our team is here to help.
            </p>
            <div class="baw-sig-row" style="display:table;width:100%;">
              <a href="tel:${CLAIMS_PHONE.replace(/\s/g,"")}" class="baw-sig-btn" style="display:inline-block;background:#1d3a8a;color:#ffffff!important;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:6px;margin-right:8px;">📞 ${CLAIMS_PHONE}</a>
              <a href="mailto:${CLAIMS_EMAIL}" class="baw-sig-btn" style="display:inline-block;background:#ffffff;color:#1d3a8a!important;border:1px solid #cbd5e1;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:6px;">✉️ ${CLAIMS_EMAIL}</a>
            </div>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;border-top:1px solid #e2e8f0;padding-top:18px;">
            <tr>
              <td style="font-size:14px;color:#0f172a;line-height:1.55;">
                <p style="margin:0 0 4px 0;">Kind regards,</p>
                <p style="margin:0;font-weight:700;color:#1d3a8a;font-size:15px;">The Warranty Claims Team</p>
                <p style="margin:2px 0 0 0;color:#64748b;font-size:13px;">Buy a Warranty · <a href="https://buyawarranty.co.uk" style="color:#64748b;text-decoration:underline;">buyawarranty.co.uk</a></p>
                <p style="margin:8px 0 0 0;color:#94a3b8;font-size:12px;">Opening hours: Monday–Friday, 9:00am–5:30pm (excl. bank holidays)</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#0f172a;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
            This email was sent to you because you have an active claim with Buy a Warranty.<br/>
            © ${new Date().getFullYear()} Buy a Warranty. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body></html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      claimId,
      status,
      dryRun,
      subjectOverride,
      headingOverride,
      bodyOverride,
      recipientOverride,
    } = await req.json();
    if (!claimId || !status) {
      return new Response(JSON.stringify({ error: "claimId and status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = normalizeStatus(status);
    const copy = STATUS_COPY[key];
    if (!copy && !bodyOverride) {
      log("No copy for status, skipping", { status });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no copy for status" }), {
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
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const firstName = (claim.name || "there").split(" ")[0];
    const reg = (claim.vehicle_registration || "").toUpperCase();
    const ref = reg || claim.id.slice(0, 8).toUpperCase();

    const subject = subjectOverride || (copy ? copy.subject(reg || ref) : `Update on your claim: ${ref}`);
    const heading = headingOverride || copy?.heading || "Update on your claim";
    const body = bodyOverride || copy?.body || "";

    // Optional alternate recipient (e.g., admin sending a copy to a different email)
    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const finalRecipient = (typeof recipientOverride === "string" && isValidEmail(recipientOverride.trim()))
      ? recipientOverride.trim()
      : claim.email;

    const html = renderHtml(firstName, heading, body, ref, subject);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        recipient: finalRecipient,
        defaultRecipient: claim.email,
        firstName,
        registration: reg,
        reference: ref,
        subject,
        heading,
        body,
        html,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");

    const payload = {
      from: "Buy a Warranty Claims <claims@buyawarranty.co.uk>",
      to: [finalRecipient],
      reply_to: "claims@buyawarranty.co.uk",
      subject,
      headers: { "X-Entity-Ref-ID": `claim-status-${claim.id}-${key}-${Date.now()}` },
      html,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    await logCustomerEmail({
      recipient_email: finalRecipient,
      recipient_name: firstName,
      subject,
      template_name: `claim_status_${key}`,
      source_function: "send-claim-status-email",
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? undefined : (result?.message || `HTTP ${res.status}`),
      metadata: { resend_message_id: result?.id, claim_id: claim.id, status: key, edited: !!(subjectOverride || bodyOverride || headingOverride), recipient_overridden: finalRecipient !== claim.email },
    });

    if (res.ok) {
      try {
        await supabase.from("claim_communications").insert({
          claim_id: claim.id,
          direction: "outbound",
          communication_type: "status_email",
          subject,
          message: body,
          sender_email: "claims@buyawarranty.co.uk",
          recipient_email: finalRecipient,
          metadata: { status: key, resend_message_id: result?.id, edited: !!(subjectOverride || bodyOverride || headingOverride), recipient_overridden: finalRecipient !== claim.email, original_customer_email: claim.email },
        });
      } catch (logErr) {
        log("claim_communications insert failed", { msg: (logErr as Error).message });
      }
    }

    if (!res.ok) throw new Error(result?.message || `Resend ${res.status}`);

    log("Sent", { id: result.id, status: key, edited: !!(subjectOverride || bodyOverride || headingOverride) });
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
