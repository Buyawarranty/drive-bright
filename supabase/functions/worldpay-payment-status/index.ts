// Check the outcome of a Worldpay payment after a 3DS challenge return.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  token: z.string().trim().min(8).max(200),
  transactionReference: z.string().trim().min(8).max(120),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { token, transactionReference } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: reqRow } = await admin
      .from("claim_inspection_requests")
      .select("id, claim_id, paid_at, status, fee_amount, inspection_company")
      .eq("token", token)
      .maybeSingle();

    if (!reqRow) return json({ error: "not_found" }, 404);
    if (reqRow.paid_at || reqRow.status === "paid") return json({ outcome: "paid" });

    const username = Deno.env.get("WORLDPAY_USERNAME");
    const password = Deno.env.get("WORLDPAY_PASSWORD");
    const env = (Deno.env.get("WORLDPAY_ENV") || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
    if (!username || !password) return json({ error: "not_configured" }, 500);

    const host = env === "live" ? "https://access.worldpay.com" : "https://try.access.worldpay.com";
    const res = await fetch(`${host}/payments/events/${encodeURIComponent(transactionReference)}`, {
      headers: {
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        Accept: "application/vnd.worldpay.payments-v6+json",
      },
    });

    if (!res.ok) {
      return json({ outcome: "unknown", detail: `events lookup ${res.status}` });
    }

    const eventsJson: any = await res.json().catch(() => ({}));
    const events: any[] = eventsJson?._embedded?.events || [];
    const types = events.map((e) => String(e?.type || "").toLowerCase());

    const isPaid = types.some((t) => t.includes("sentforsettlement") || t.includes("authorized"));
    const isRefused = types.some((t) => t.includes("refused") || t.includes("cancelled") || t.includes("error"));

    if (isPaid) {
      const amountPence = Math.round(Number(reqRow.fee_amount || 140) * 100);
      await admin
        .from("claim_inspection_requests")
        .update({ status: "paid", paid_at: new Date().toISOString(), amount_paid: amountPence / 100 })
        .eq("id", reqRow.id);
      await admin.from("claim_notes").insert({
        claim_id: reqRow.claim_id,
        note: `Independent inspection paid (£${(amountPence / 100).toFixed(2)}) via Worldpay after 3-D Secure (${transactionReference}).`,
        created_by_name: "System",
      });
      await admin
        .from("worldpay_transactions")
        .update({ status: "paid" })
        .eq("worldpay_link_id", transactionReference);
      return json({ outcome: "paid" });
    }

    return json({ outcome: isRefused ? "refused" : "pending" });
  } catch (err: any) {
    return json({ error: err?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
