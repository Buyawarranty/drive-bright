// Public status check for a website chat visitor waiting on a live specialist.
//
// The widget polls this while the visitor is on hold. If nobody picks the chat
// up within the grace window, the visitor can flag it as missed: we close the
// waiting ring and raise an urgent callback in its place so the customer is
// rung back instead of being left on hold.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Seconds a visitor waits before we treat the ring as unanswered. */
const MISSED_AFTER_SECONDS = 90;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const handoverId = typeof body?.handoverId === "string" ? body.handoverId : null;
    const markMissed = body?.markMissed === true;
    if (!handoverId) return json({ ok: false, error: "no_handover" }, 400);

    const { data: row, error } = await admin
      .from("ai_sandbox_handovers")
      .select(
        "id, thread_id, kind, status, reason, customer_name, customer_email, customer_phone, registration, cover_summary, quoted_price, created_at, claimed_at",
      )
      .eq("id", handoverId)
      .maybeSingle();

    if (error || !row) return json({ ok: false, error: "not_found" }, 404);

    const waitedSeconds = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000);

    // Still waiting and past the grace window — escalate to an urgent callback.
    if (markMissed && row.status === "waiting" && waitedSeconds >= MISSED_AFTER_SECONDS) {
      await admin
        .from("ai_sandbox_handovers")
        .update({ status: "missed" })
        .eq("id", row.id)
        .eq("status", "waiting");

      const { data: escalated } = await admin
        .from("ai_sandbox_handovers")
        .insert({
          thread_id: row.thread_id,
          created_by: null,
          kind: "callback_request",
          reason: `URGENT — live chat unanswered after ${waitedSeconds}s (${row.reason ?? "live_agent_requested"})`,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_phone: row.customer_phone,
          registration: row.registration,
          cover_summary: row.cover_summary,
          quoted_price: row.quoted_price,
          status: "waiting",
        })
        .select("id")
        .maybeSingle();

      return json({
        ok: true,
        status: "missed",
        waited_seconds: waitedSeconds,
        escalated_handover_id: escalated?.id ?? null,
      });
    }

    return json({
      ok: true,
      status: row.status,
      kind: row.kind,
      waited_seconds: waitedSeconds,
      missed_after_seconds: MISSED_AFTER_SECONDS,
      claimed: Boolean(row.claimed_at),
    });
  } catch (e) {
    console.error("[sandbox-handover-status] threw", e);
    return json({ ok: false, error: "unexpected" }, 500);
  }
});
