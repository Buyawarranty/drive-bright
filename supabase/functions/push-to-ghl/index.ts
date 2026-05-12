import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildGhlPayload(input: any, locationId: string) {
  const fullName: string = (input.full_name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");
  const addr = input.address || {};
  const street = [addr.flat_number, addr.building_name, addr.building_number, addr.street]
    .filter(Boolean)
    .join(" ")
    .trim();

  const customFields = [
    { key: "vehicle_reg", value: input.vehicle_reg },
    { key: "vehicle_make", value: input.vehicle_make },
    { key: "vehicle_model", value: input.vehicle_model },
    { key: "vehicle_year", value: input.vehicle_year },
    { key: "mileage", value: input.mileage },
    { key: "step_abandoned", value: input.step_abandoned },
    { key: "plan_name", value: input.plan_name },
    { key: "plan_id", value: input.plan_id },
    { key: "total_price", value: input.total_price },
    { key: "payment_type", value: input.payment_type },
    { key: "fbclid", value: input.fbclid },
    { key: "gclid", value: input.gclid },
  ]
    .filter((f) => f.value !== undefined && f.value !== null && f.value !== "")
    .map((f) => ({ key: String(f.key), field_value: String(f.value) }));

  return {
    locationId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName || undefined,
    email: input.email,
    phone: input.phone,
    address1: street || undefined,
    city: addr.town || undefined,
    state: addr.county || undefined,
    postalCode: addr.postcode || undefined,
    country: addr.country || "GB",
    source: "buyawarranty - step 2",
    tags: ["buyawarranty", `step-${input.step_abandoned ?? ""}`],
    customFields,
  };
}

async function postToGhl(apiKey: string, payload: any): Promise<{ ok: boolean; status: number; body: string }> {
  // Try v2 upsert endpoint first (works with Private Integration tokens "pit-...")
  const res = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Version": "2021-07-28",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 800) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GHL_API_KEY");
    const locationId = Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) {
      console.warn("GHL_API_KEY or GHL_LOCATION_ID not configured — skipping push");
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = await req.json();
    const payload = buildGhlPayload(input, locationId);

    let result;
    try {
      result = await postToGhl(apiKey, payload);
    } catch (err: any) {
      result = { ok: false, status: 0, body: err?.message || "network_error" };
    }

    if (result.ok) {
      console.log(`✅ GHL contact upserted for ${input.email}: ${result.body}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.warn(`⚠️ GHL push failed (${result.status}) — queueing for retry: ${result.body}`);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    await supabase.from("ghl_push_queue").insert({
      payload,
      status: "pending",
      attempts: 1,
      last_error: `HTTP ${result.status}: ${result.body}`,
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    });

    return new Response(JSON.stringify({ queued: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("push-to-ghl fatal error (non-blocking):", error);
    return new Response(JSON.stringify({ error: error?.message || "unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
