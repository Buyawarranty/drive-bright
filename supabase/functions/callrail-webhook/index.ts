// Public webhook receiver for CallRail events (pre_call, call_complete/post_call, call_modified).
// - Upserts a row in public.callrail_calls (for real-time incoming/missed call banners)
// - Also inserts into public.missed_calls when the call is missed (legacy alert bar)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-callrail-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pick<T = string>(obj: any, keys: string[]): T | null {
  for (const k of keys) {
    const v = k.split(".").reduce((o: any, p: string) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return null;
}

function normaliseStatus(raw: string | null | undefined, answered: any, duration: number): string {
  const s = String(raw ?? "").toLowerCase();
  if (["in-progress", "ringing", "pre_call", "incoming"].includes(s)) return "ringing";
  if (["completed", "answered", "call_complete", "post_call"].includes(s) && (answered === true || duration > 0)) return "completed";
  if (["missed", "no-answer", "noanswer", "busy", "failed", "voicemail"].includes(s)) return "missed";
  if (answered === false && duration === 0) return "missed";
  if (answered === true) return "completed";
  return s || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || "callrail").toLowerCase();

    // Parse body (JSON or form-encoded)
    let payload: any = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
      if (payload.answered != null) payload.answered = String(payload.answered).toLowerCase() === "true";
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Field extraction (defensive against CallRail's varying payload shapes)
    const callrail_call_id = String(
      pick(payload, ["id", "call_id", "resource_id", "callrail_call_id"]) ?? crypto.randomUUID()
    );
    const direction = String(pick(payload, ["direction"]) ?? "inbound").toLowerCase();
    const caller_number = pick(payload, ["caller_id", "customer_phone_number", "from", "from_number", "phone"]);
    const caller_name = pick(payload, ["customer_name", "caller_name", "name"]);
    const caller_city = pick(payload, ["customer_city", "caller_city"]);
    const caller_state = pick(payload, ["customer_state", "caller_state"]);
    const tracker_id = pick(payload, ["tracker_id", "company_id"]);
    const tracked_number = pick(payload, ["tracking_number", "to", "to_number", "destination"]);
    const recording_url = pick(payload, ["recording", "recording_url", "voicemail_url"]);
    const started_at_raw = pick(payload, ["start_time", "called_at", "timestamp"]);
    const duration = Number(pick(payload, ["duration", "call_duration"]) ?? 0) || 0;
    const answered_raw = payload?.answered;
    const status = normaliseStatus(
      pick(payload, ["call_status", "status", "disposition", "event"]),
      answered_raw,
      duration
    );
    const started_at = started_at_raw ? new Date(started_at_raw as any).toISOString() : new Date().toISOString();

    // Look up tracking number → assigned admin
    let tracking_number_id: string | null = null;
    let assigned_admin_user_id: string | null = null;
    if (tracker_id) {
      const { data: tn } = await supabase
        .from("callrail_tracking_numbers")
        .select("id, assigned_admin_user_id")
        .eq("callrail_tracker_id", String(tracker_id))
        .maybeSingle();
      if (tn) {
        tracking_number_id = tn.id;
        assigned_admin_user_id = tn.assigned_admin_user_id;
      }
    }

    // Match to existing lead / customer by last-9 phone digits
    let matched_lead_id: string | null = null;
    let matched_customer_id: string | null = null;
    if (caller_number) {
      const digits = String(caller_number).replace(/\D/g, "").replace(/^44/, "0");
      const last9 = digits.slice(-9);
      if (last9) {
        const [{ data: lead }, { data: cust }] = await Promise.all([
          supabase.from("sales_leads").select("id").ilike("phone", `%${last9}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("customers").select("id").ilike("phone", `%${last9}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        matched_lead_id = lead?.id ?? null;
        matched_customer_id = cust?.id ?? null;
      }
    }

    // Upsert into callrail_calls (real-time source for banners)
    const answered_at = status === "completed" && answered_raw !== false ? started_at : null;
    const ended_at = duration > 0 ? new Date(new Date(started_at).getTime() + duration * 1000).toISOString() : null;

    const { error: upsertError } = await supabase
      .from("callrail_calls")
      .upsert(
        {
          callrail_call_id,
          direction,
          status,
          caller_number,
          caller_name,
          caller_city,
          caller_state,
          tracker_id,
          tracked_number,
          tracking_number_id,
          assigned_admin_user_id,
          matched_lead_id,
          matched_customer_id,
          started_at,
          answered_at,
          ended_at,
          duration_seconds: duration || null,
          recording_url,
          raw: payload,
        },
        { onConflict: "callrail_call_id" }
      );

    if (upsertError) {
      console.error("[callrail-webhook] callrail_calls upsert error", upsertError);
    }

    // Backwards-compatible missed_calls insert (legacy alert bar in New Leads)
    if (status === "missed") {
      const { error: mErr } = await supabase.from("missed_calls").insert({
        provider,
        caller_phone: caller_number,
        caller_name,
        tracking_number: tracked_number,
        call_status: status,
        call_duration: duration || null,
        recording_url,
        call_started_at: started_at,
        matched_lead_id,
        matched_customer_id,
        raw_payload: payload,
      });
      if (mErr) console.error("[callrail-webhook] missed_calls insert error", mErr);
    }

    return new Response(JSON.stringify({ ok: true, status, callrail_call_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[callrail-webhook] error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
