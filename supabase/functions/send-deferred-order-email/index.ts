// Pay later orders: confirmation, payment link and chase reminders.
//
// kind = 'confirmation'  → sent as soon as the agent saves the order
// kind = 'payment_link'  → the agent (or the chase job) sends a payment link
// kind = 'reminder'      → scheduled chase before/after the agreed payment date
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(["confirmation", "payment_link", "reminder"]).default("confirmation"),
  paymentUrl: z.string().url().max(2000).optional().nullable(),
  bumperUrl: z.string().url().max(2000).optional().nullable(),
  overdueDays: z.number().int().optional().nullable(),
  daysBeforeStart: z.number().int().optional().nullable(),
});

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const ukDate = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
      })
    : "—";

const TERM: Record<string, string> = {
  yearly: "1 year", "12months": "1 year",
  "2-Year": "2 years", "24months": "2 years",
  "3-Year": "3 years", "36months": "3 years",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { customerId, kind, paymentUrl, bumperUrl, overdueDays } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: c, error } = await admin
      .from("customers")
      .select(
        "id, name, email, registration_plate, vehicle_make, vehicle_model, plan_type, payment_type, final_amount, warranty_reference_number, deferred_start_date, deferred_payment_due_date, deferred_payment_link, deferred_bumper_link, deferred_status",
      )
      .eq("id", customerId)
      .maybeSingle();

    if (error) throw error;
    if (!c) return json({ error: "Order not found" }, 404);
    if (!c.email) return json({ error: "Order has no email address" }, 400);

    const link = paymentUrl || c.deferred_payment_link || null;
    const bumper = bumperUrl || (c as any).deferred_bumper_link || null;
    const amount = gbp(Number(c.final_amount) || 0);
    const startDate = ukDate(c.deferred_start_date);
    const dueDate = ukDate(c.deferred_payment_due_date);
    const term = TERM[c.payment_type || ""] || c.payment_type || "";
    const vehicle = [c.vehicle_make, c.vehicle_model].filter(Boolean).join(" ");

    const intro = kind === "confirmation"
      ? `Thanks for arranging your warranty with us. Everything is set up and ready — we just need your payment to switch the cover on.`
      : kind === "payment_link"
        ? `Here's the secure link to pay for your warranty. As soon as it's paid we'll activate your cover and email your documents.`
        : (overdueDays && overdueDays > 0)
          ? `We haven't received your payment yet, so your cover hasn't started. You can pay securely using the link below.`
          : `A quick reminder that your warranty payment is due on ${dueDate}. Once it's paid your cover starts as agreed.`;

    const subject = kind === "confirmation"
      ? `Your warranty is ready — cover starts ${startDate}`
      : (overdueDays && overdueDays > 0)
        ? `Your warranty payment is outstanding — ${c.registration_plate || ""}`.trim()
        : `Your warranty payment (${amount}) — ${c.registration_plate || ""}`.trim();

    const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#0f172a;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;">Buy A Warranty</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p style="font-size:16px;margin:0 0 14px;">Hi ${c.name || "there"},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">${intro}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
        <tr><td style="padding:8px 0;color:#6b7280;">Vehicle</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${c.registration_plate || "—"}${vehicle ? ` · ${vehicle}` : ""}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Cover</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${c.plan_type || "Platinum"}${term ? ` · ${term}` : ""}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Reference</td><td style="padding:8px 0;text-align:right;">${c.warranty_reference_number || "—"}</td></tr>
      </table>

      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin-bottom:18px;">
        <p style="margin:0 0 6px;font-size:15px;"><strong>Your cover starts:</strong> ${startDate}</p>
        <p style="margin:0;font-size:15px;"><strong>Your payment is due:</strong> ${dueDate}</p>
        <p style="margin:10px 0 0;font-size:13px;color:#92400e;">Your warranty is designed to begin once the payment has been received.</p>
      </div>

      ${(link || bumper) ? `
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;"><strong>Two ways to pay — whichever suits you best:</strong></p>
      ${link ? `
      <div style="text-align:center;margin:0 0 14px;">
        <a href="${link}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:bold;">Pay ${amount} now by card</a>
      </div>` : ""}
      ${bumper ? `
      <div style="text-align:center;margin:0 0 14px;">
        <a href="${bumper}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:bold;">Spread the cost with Bumper</a>
        <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Interest-free monthly instalments. Credit subject to status, 18+, UK only.</p>
      </div>` : ""}
      <p style="font-size:12px;color:#6b7280;word-break:break-all;margin-top:14px;">
        If the buttons don't work, copy these links into your browser:
        ${link ? `<br>Card: ${link}` : ""}
        ${bumper ? `<br>Bumper: ${bumper}` : ""}
      </p>
      ` : `
      <p style="font-size:14px;line-height:1.6;">We'll send you a secure payment link shortly — you can pay in full by card or spread the cost with Bumper. If you'd like to pay now, just reply to this email or call us on 0330 229 5045.</p>
      `}

      <p style="font-size:14px;line-height:1.6;margin-top:20px;">Any questions at all, reply to this email or call <strong>0330 229 5045</strong> and we'll help.</p>
      <p style="font-size:14px;margin:18px 0 0;">Kind regards,<br>The Buy A Warranty team</p>
    </div>
  </div>
</body></html>`;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    const { error: sendError } = await resend.emails.send({
      from: "Buy A Warranty <info@buyawarranty.co.uk>",
      to: [c.email],
      subject,
      html,
    });
    if (sendError) throw sendError;

    return json({ ok: true, sent_to: c.email, kind });
  } catch (e) {
    console.error("[send-deferred-order-email]", e);
    return json({ error: (e as Error).message || "Failed to send" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
