import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADMIN_PORTAL_URL = "https://buyawarranty.co.uk/admin-dashboard/?tab=claims";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppealRequest {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  claimRef?: string;
  registrationPlate?: string;
  warrantyNumber?: string;
  decisionDate?: string;
  grounds?: string;
  newEvidence: string;
  desiredOutcome?: string;
  independentInspection?: string;
  preferredContactMethod?: string;
  // 'request' = short public request from the footer "Warranty appeals" page.
  // 'full' = complete appeal, only reachable via emailed secure link or the
  // signed-in customer dashboard.
  mode?: "request" | "full";
  token?: string;
}

const esc = (s: string) => String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");

function generateReference(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(10000 + Math.random() * 90000);
  return `BAW-A-${year}-${num}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: AppealRequest = await req.json();
    const {
      firstName, lastName, email, phone, claimRef, registrationPlate, warrantyNumber,
      decisionDate, grounds, newEvidence, desiredOutcome,
      independentInspection, preferredContactMethod, mode,
    } = body;

    const isRequest = mode === "request";

    // We already hold the customer's record, so an appeal only needs their name,
    // ONE identifier (registration OR warranty number) and why they're appealing.
    const identifier = (registrationPlate || "").trim() || (warrantyNumber || "").trim();
    if (!firstName || !identifier || !newEvidence) {
      return new Response(JSON.stringify({
        success: false,
        error: "Please give your name, your registration or warranty number, and why you're appealing",
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const reference = generateReference();
    const reg = (registrationPlate || "").trim().toUpperCase();
    const regNorm = reg.replace(/\s+/g, "");
    const warranty = (warrantyNumber || "").trim().toUpperCase();
    const customerName = `${firstName} ${lastName || ""}`.trim();

    // Look the customer up from whichever identifier they gave so we can email an
    // immediate acknowledgement even when they didn't type their email address.
    let customerEmail = (email || "").trim().toLowerCase();
    try {
      let q = supabase.from("customers").select("email, name, registration_plate, warranty_number").limit(1);
      q = regNorm
        ? q.ilike("registration_plate", `%${regNorm}%`)
        : q.ilike("warranty_number", `%${warranty}%`);
      const { data: cust } = await q.maybeSingle();
      if (!customerEmail && cust?.email) customerEmail = String(cust.email).trim().toLowerCase();
    } catch (e) {
      console.error("customer lookup failed", e);
    }

    // Find the most recent claim for this registration / email so the appeal
    // attaches to the right claim file and shows in the Appeals inbox.
    const filters = [
      regNorm ? `vehicle_registration.ilike.%${regNorm}%` : null,
      customerEmail ? `email.ilike.${customerEmail}` : null,
    ].filter(Boolean) as string[];
    const { data: claims } = await supabase
      .from("claims_submissions")
      .select("id, claim_reason, name, vehicle_registration")
      .or(filters.length ? filters.join(",") : "id.is.null")
      .neq("status", "fake_test")
      .order("created_at", { ascending: false })
      .limit(1);

    let claim = claims?.[0] || null;
    let requestToken: string | null = null;

    const summary = [
      isRequest ? "APPEAL REQUESTED — customer asked for an appeal from the public Warranty appeals page. Send them the secure appeal link." : null,
      grounds ? `Grounds: ${grounds}` : null,
      decisionDate ? `Decision date: ${decisionDate}` : null,
      claimRef ? `Customer claim reference: ${claimRef}` : null,
      `Independent inspection: ${independentInspection || "Not stated"}`,
      `Preferred contact: ${preferredContactMethod || "Email"}`,
      "",
      newEvidence,
      desiredOutcome ? `\nDesired outcome: ${desiredOutcome}` : "",
    ].filter(Boolean).join("\n");

    // No existing claim on file? Open one from the appeal itself so the appeal
    // always shows in the Claims section instead of being lost.
    if (!claim) {
      const { data: created, error: createError } = await supabase
        .from("claims_submissions")
        .insert({
          name: customerName || "Appeal (name not given)",
          email: customerEmail || "no-email@buyawarranty.co.uk",
          phone: phone || null,
          vehicle_registration: reg || warranty || null,
          claim_reason: grounds || "Appeal submitted online",
          message: summary,
          status: "appealed",
          priority: "high",
          internal_notes: "Created automatically from the public appeals form — no earlier claim matched this registration or email. Please check the policy details.",
        })
        .select("id, claim_reason, name, vehicle_registration")
        .single();
      if (createError) console.error("could not open claim for appeal", createError);
      claim = created || null;
    }

    if (claim) {

      // Open appeal on the claim (idempotent-ish: only one open appeal per claim).
      const { data: existing } = await supabase
        .from("claim_appeals")
        .select("id")
        .eq("claim_id", claim.id)
        .is("closed_at", null)
        .maybeSingle();

      if (!existing) {
        await supabase.from("claim_appeals").insert({
          claim_id: claim.id,
          reason: isRequest ? "Appeal requested by customer (awaiting full appeal form)" : (grounds || "Appeal submitted online"),
          new_evidence: newEvidence,
          status: "open",
          customer_email: customerEmail || null,
          sent_at: new Date().toISOString(),
        });
      }

      // Record the customer's submission so it appears as a returned appeal.
      const { data: request } = await supabase
        .from("claim_update_requests")
        .insert({
          claim_id: claim.id,
          recipient_email: customerEmail || null,
          vehicle_registration: reg || warranty,
          claim_reason: claim.claim_reason,
          customer_name: customerName,
          is_responded: true,
        })
        .select("id, token")
        .single();
      requestToken = request?.token ?? null;

      await supabase.from("claim_update_responses").insert({
        claim_id: claim.id,
        request_id: request?.id ?? null,
        respondent_name: customerName,
        respondent_email: customerEmail || null,
        status_update: isRequest ? "Appeal requested online" : "Appeal submitted online",
        notes: summary,
        is_read: false,
      });

      // Move the claim to the Appeal stage so the status shown in Claims matches.
      await supabase
        .from("claims_submissions")
        .update({ status: "appealed", updated_at: new Date().toISOString() })
        .eq("id", claim.id);

      await supabase.from("claim_audit_log").insert({
        claim_id: claim.id,
        action: "appeal_submitted",
        field: "status",
        new_value: "appealed",
        reason: isRequest ? "Appeal requested from the public appeals form." : "Appeal submitted from the public appeals form.",
      }).then(({ error }) => { if (error) console.error("audit log failed", error); });

    }

    // Internal notification
    const subject = isRequest
      ? `Appeal REQUESTED — ${reg} — ${customerName}`
      : `Appeal submitted — ${reg} — ${customerName}`;
    const internalHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:640px;margin:0 auto;padding:20px;">
        <div style="background:#1A2B4A;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">⚖️ ${isRequest ? "Appeal requested" : "Appeal submitted"} — ${esc(reg || warranty)} — ${esc(customerName)}</h1>
          <p style="margin:6px 0 0;opacity:.85;font-size:13px;">Reference: <strong>${reference}</strong></p>
        </div>
        <div style="background:#f7f8fa;padding:24px;border-radius:0 0 8px 8px;">
          <div style="text-align:center;margin-bottom:18px;">
            <a href="${ADMIN_PORTAL_URL}" style="display:inline-block;background:#E8541A;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:600;font-size:14px;">Open in Claims Portal →</a>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#666;width:170px;">Name</td><td style="padding:6px 0;"><strong>${esc(customerName)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;">${esc(customerEmail || "—")}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">${esc(phone || "—")}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Registration</td><td style="padding:6px 0;"><strong>${esc(reg || warranty)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Grounds</td><td style="padding:6px 0;">${esc(grounds || "Not given")}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Matched claim</td><td style="padding:6px 0;">${claim ? esc(claim.id) : "No matching claim found — please check"}</td></tr>
          </table>
          <div style="margin-top:18px;padding:14px;background:#fff;border-left:3px solid #E8541A;border-radius:6px;white-space:pre-wrap;font-size:14px;">${esc(summary)}</div>
        </div>
      </body></html>`;

    const customerHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:20px;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
          <div style="background:#1A2B4A;padding:24px;text-align:center;">
            <div style="font-size:20px;font-weight:600;color:#fff;">buy<span style="color:#E8541A;">a</span>warranty</div>
          </div>
          <div style="padding:28px;">
             <h2 style="font-size:18px;color:#1A2B4A;margin:0 0 12px;">${isRequest ? "Your appeal request is acknowledged" : "Your appeal is acknowledged"}</h2>
            <p style="font-size:14px;color:#444;line-height:1.65;">Hi ${esc(firstName)},</p>
            <p style="font-size:14px;color:#444;line-height:1.65;">${isRequest
              ? "Thank you for requesting an appeal. Our claims team will email you a secure link so you can complete your full appeal — you can also start it from your customer dashboard."
              : "Thank you for sending your appeal. A claims manager will review it independently of the original decision and we'll be in touch with the outcome."}</p>
            <div style="background:#f7f8fa;border-radius:8px;padding:14px 18px;margin:16px 0;border-left:3px solid #E8541A;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${isRequest ? "Your request reference" : "Your appeal reference"}</div>
              <div style="font-size:17px;font-weight:600;color:#1A2B4A;">${reference}</div>
            </div>
             <p style="font-size:14px;color:#444;line-height:1.65;">This email is your acknowledgement that we have received your ${isRequest ? "request" : "appeal"}. It is with our claims team now, and they will contact you within <strong>2 working days</strong>. We will keep you updated by email at every stage.</p>
            <p style="font-size:13px;color:#666;line-height:1.65;">If an independent engineer's inspection is arranged, please allow up to <strong>3 weeks</strong> for the visit, depending on engineer availability in your area.</p>
          </div>
          <div style="background:#f7f8fa;padding:16px 24px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;">
            Buy a Warranty Limited · Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT<br>
            Registered in England &amp; Wales · Company No. 10314860
          </div>
        </div>
      </body></html>`;

    if (RESEND_API_KEY) {
      const send = (to: string[], subj: string, html: string) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: "Buy A Warranty <claims@buyawarranty.co.uk>", to, subject: subj, html }),
        }).catch((e) => console.error("email failed", e));

      await send(["claims@buyawarranty.co.uk"], subject, internalHtml);
       if (customerEmail) await send([customerEmail], isRequest ? `Appeal request acknowledged — ${reference}` : `Appeal acknowledged — ${reference}`, customerHtml);
    }

    return new Response(JSON.stringify({
      success: true,
      reference,
      matchedClaim: !!claim,
      mode: isRequest ? "request" : "full",
      token: requestToken,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("submit-appeal error", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || "Unexpected error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
