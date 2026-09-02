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
  lastName: string;
  email: string;
  phone?: string;
  claimRef?: string;
  registrationPlate: string;
  decisionDate?: string;
  grounds: string;
  newEvidence: string;
  desiredOutcome?: string;
  independentInspection?: string;
  preferredContactMethod?: string;
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
      firstName, lastName, email, phone, claimRef, registrationPlate,
      decisionDate, grounds, newEvidence, desiredOutcome,
      independentInspection, preferredContactMethod,
    } = body;

    if (!firstName || !lastName || !email || !registrationPlate || !grounds || !newEvidence) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const reference = generateReference();
    const reg = registrationPlate.trim().toUpperCase();
    const regNorm = reg.replace(/\s+/g, "");
    const customerName = `${firstName} ${lastName}`.trim();

    // Find the most recent claim for this registration / email so the appeal
    // attaches to the right claim file and shows in the Appeals inbox.
    const filters = [`vehicle_registration.ilike.%${regNorm}%`, `email.ilike.${email.trim()}`];
    const { data: claims } = await supabase
      .from("claims_submissions")
      .select("id, claim_reason, name, vehicle_registration")
      .or(filters.join(","))
      .neq("status", "fake_test")
      .order("created_at", { ascending: false })
      .limit(1);

    const claim = claims?.[0] || null;

    const summary = [
      `Grounds: ${grounds}`,
      decisionDate ? `Decision date: ${decisionDate}` : null,
      claimRef ? `Customer claim reference: ${claimRef}` : null,
      `Independent inspection: ${independentInspection || "Not stated"}`,
      `Preferred contact: ${preferredContactMethod || "Email"}`,
      "",
      newEvidence,
      desiredOutcome ? `\nDesired outcome: ${desiredOutcome}` : "",
    ].filter(Boolean).join("\n");

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
          reason: grounds,
          new_evidence: newEvidence,
          status: "open",
          customer_email: email.trim().toLowerCase(),
          sent_at: new Date().toISOString(),
        });
      }

      // Record the customer's submission so it appears as a returned appeal.
      const { data: request } = await supabase
        .from("claim_update_requests")
        .insert({
          claim_id: claim.id,
          recipient_email: email.trim().toLowerCase(),
          vehicle_registration: reg,
          claim_reason: claim.claim_reason,
          customer_name: customerName,
          is_responded: true,
        })
        .select("id")
        .single();

      await supabase.from("claim_update_responses").insert({
        claim_id: claim.id,
        request_id: request?.id ?? null,
        respondent_name: customerName,
        respondent_email: email.trim().toLowerCase(),
        status_update: "Appeal submitted online",
        notes: summary,
        is_read: false,
      });
    }

    // Internal notification
    const subject = `Appeal submitted — ${reg} — ${customerName}`;
    const internalHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:640px;margin:0 auto;padding:20px;">
        <div style="background:#1A2B4A;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">⚖️ Appeal submitted — ${esc(reg)} — ${esc(customerName)}</h1>
          <p style="margin:6px 0 0;opacity:.85;font-size:13px;">Reference: <strong>${reference}</strong></p>
        </div>
        <div style="background:#f7f8fa;padding:24px;border-radius:0 0 8px 8px;">
          <div style="text-align:center;margin-bottom:18px;">
            <a href="${ADMIN_PORTAL_URL}" style="display:inline-block;background:#E8541A;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:600;font-size:14px;">Open in Claims Portal →</a>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#666;width:170px;">Name</td><td style="padding:6px 0;"><strong>${esc(customerName)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;">${esc(email)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">${esc(phone || "—")}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Registration</td><td style="padding:6px 0;"><strong>${esc(reg)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Grounds</td><td style="padding:6px 0;">${esc(grounds)}</td></tr>
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
            <h2 style="font-size:18px;color:#1A2B4A;margin:0 0 12px;">We've received your appeal</h2>
            <p style="font-size:14px;color:#444;line-height:1.65;">Hi ${esc(firstName)},</p>
            <p style="font-size:14px;color:#444;line-height:1.65;">Thank you for sending your appeal. A claims manager will review it independently of the original decision and we'll be in touch with the outcome.</p>
            <div style="background:#f7f8fa;border-radius:8px;padding:14px 18px;margin:16px 0;border-left:3px solid #E8541A;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Your appeal reference</div>
              <div style="font-size:17px;font-weight:600;color:#1A2B4A;">${reference}</div>
            </div>
            <p style="font-size:14px;color:#444;line-height:1.65;">We'll acknowledge your appeal within 2 working days.</p>
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
      await send([email.trim()], `Your appeal reference ${reference}`, customerHtml);
    }

    return new Response(JSON.stringify({ success: true, reference, matchedClaim: !!claim }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("submit-appeal error", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || "Unexpected error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
