import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildGhlPayload(input: any) {
  const fullName: string = (input.full_name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");
  const addr = input.address || {};
  const street = [addr.flat_number, addr.building_name, addr.building_number, addr.street]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
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
    customField: {
      vehicle_reg: input.vehicle_reg,
      vehicle_make: input.vehicle_make,
      vehicle_model: input.vehicle_model,
      vehicle_year: input.vehicle_year,
      mileage: input.mileage,
      step_abandoned: input.step_abandoned,
      plan_name: input.plan_name,
      plan_id: input.plan_id,
      total_price: input.total_price,
      payment_type: input.payment_type,
      fbclid: input.fbclid,
      gclid: input.gclid,
    },
  };
}

async function postToGhl(webhookUrl: string, payload: any): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const webhookUrl = Deno.env.get("GHL_WEBHOOK_URL");
    if (!webhookUrl) {
      console.warn("GHL_WEBHOOK_URL not configured — skipping push");
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = await req.json();
    const payload = buildGhlPayload(input);

    let result;
    try {
      result = await postToGhl(webhookUrl, payload);
    } catch (err: any) {
      result = { ok: false, status: 0, body: err?.message || "network_error" };
    }

    if (result.ok) {
      console.log(`✅ GHL push success for ${input.email}`);
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
