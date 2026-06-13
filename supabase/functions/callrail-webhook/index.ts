// Public webhook receiver for CallRail / Zoiper / Dial9 missed-call events.
// Inserts a row into public.missed_calls so the New Leads alert bar lights up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pick<T = string>(obj: any, keys: string[]): T | null {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return null;
}

function isMissed(payload: any): boolean {
  const status = String(
    pick(payload, ["answered", "call_status", "status", "disposition"]) ?? ""
  ).toLowerCase();
  if (status === "false" || status === "missed" || status === "no-answer" || status === "noanswer" || status === "busy" || status === "failed" || status === "voicemail") return true;
  // CallRail sends `answered: false` for missed calls
  if (payload?.answered === false) return true;
  // Explicit flag from custom integrations
  if (payload?.missed === true) return true;
  // Zero/short duration with answered=false
  const dur = Number(pick(payload, ["duration", "call_duration"]) ?? 0);
  if (!payload?.answered && dur === 0) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || "callrail").toLowerCase();

    let payload: any = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
      if (payload.answered != null) payload.answered = String(payload.answered).toLowerCase() === "true";
    }

    if (!isMissed(payload)) {
      return new Response(JSON.stringify({ ok: true, skipped: "not a missed call" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const caller_phone = pick(payload, ["caller_id", "customer_phone_number", "from", "from_number", "phone"]);
    const caller_name = pick(payload, ["customer_name", "caller_name", "name"]);
    const tracking_number = pick(payload, ["tracking_number", "to", "to_number", "destination"]);
    const recording_url = pick(payload, ["recording", "recording_url", "voicemail_url"]);
    const call_started_at = pick(payload, ["start_time", "called_at", "timestamp"]);
    const call_duration = Number(pick(payload, ["duration", "call_duration"]) ?? 0) || null;
    const call_status = String(pick(payload, ["call_status", "status", "disposition"]) ?? "missed");

    // Try to match an existing lead by phone (last 9 digits, UK strip leading 0/44)
    let matched_lead_id: string | null = null;
    let matched_customer_id: string | null = null;
    if (caller_phone) {
      const digits = String(caller_phone).replace(/\D/g, "").replace(/^44/, "0");
      const last9 = digits.slice(-9);
      if (last9) {
        const { data: lead } = await supabase
          .from("sales_leads")
          .select("id")
          .ilike("phone", `%${last9}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matched_lead_id = lead?.id ?? null;
        const { data: cust } = await supabase
          .from("customers")
          .select("id")
          .ilike("phone", `%${last9}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matched_customer_id = cust?.id ?? null;
      }
    }

    const { data, error } = await supabase
      .from("missed_calls")
      .insert({
        provider,
        caller_phone,
        caller_name,
        tracking_number,
        call_status,
        call_duration,
        recording_url,
        call_started_at: call_started_at ? new Date(call_started_at).toISOString() : new Date().toISOString(),
        matched_lead_id,
        matched_customer_id,
        raw_payload: payload,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[callrail-webhook] insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
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
