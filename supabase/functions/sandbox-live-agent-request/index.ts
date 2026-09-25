// Public "Speak to a live agent" handler for the website chat widget.
// The visitor is put on hold in the chat and we create a waiting live_handover
// row, which makes the admin / super admin dashboard ring (SandboxHandoverAlerts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const START_HOUR = 9;
const END_HOUR = 18;

function isOpenNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return OPEN_DAYS.includes(dayIndex) && hour >= START_HOUR && hour < END_HOUR;
}

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

    const guestToken = String(body?.guestToken ?? "").slice(0, 64);
    const registration = String(body?.registration ?? "").toUpperCase().replace(/\s/g, "").slice(0, 12);
    const quotedPrice = Number.isFinite(Number(body?.quotedPrice)) ? Number(body.quotedPrice) : null;
    const source = String(body?.source ?? "website-chat").slice(0, 80);
    let threadId = typeof body?.threadId === "string" ? body.threadId : null;

    if (!threadId && guestToken) {
      const { data: t } = await admin
        .from("ai_sandbox_threads")
        .select("id")
        .eq("guest_token", guestToken)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      threadId = t?.id ?? null;
    }

    if (!threadId) {
      return json(
        { ok: false, error: "no_thread", message: "Send a message first, then we can connect you." },
        400,
      );
    }

    const open = isOpenNow();
    const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: presence, error: presenceError } = await admin
      .from("ai_sandbox_specialist_presence")
      .select("override_hours")
      .eq("is_online", true)
      .gte("last_seen_at", cutoff);
    if (presenceError) throw presenceError;
    const specialistLive = (presence ?? []).some((row) => open || row.override_hours);
    if (!specialistLive) {
      return json(
        { ok: false, error: "no_live_specialist", message: "No specialist is available right now. Please call, WhatsApp us or request a callback." },
        409,
      );
    }

    // Don't stack duplicate rings for the same conversation.
    const { data: existing } = await admin
      .from("ai_sandbox_handovers")
      .select("id, status")
      .eq("thread_id", threadId)
      .eq("kind", "live_handover")
      .eq("status", "waiting")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return json({ ok: true, handover_id: existing.id, already_waiting: true, is_open: open, specialist_live: true });
    }

    const { data: inserted, error } = await admin
      .from("ai_sandbox_handovers")
      .insert({
        thread_id: threadId,
        kind: "live_handover",
        reason: open ? `live_agent_requested (${source})` : `live_agent_requested_out_of_hours (${source})`,
        registration: registration || null,
        quoted_price: quotedPrice,
        status: "waiting",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[sandbox-live-agent-request] insert failed", error);
      return json(
        { ok: false, error: "insert_failed", message: "We couldn't connect you — please call 0330 229 5040." },
        500,
      );
    }

    return json({ ok: true, handover_id: inserted.id, is_open: open, specialist_live: true });
  } catch (e) {
    console.error("[sandbox-live-agent-request] threw", e);
    return json(
      { ok: false, error: "unexpected", message: "Something went wrong — please call 0330 229 5040." },
      500,
    );
  }
});
