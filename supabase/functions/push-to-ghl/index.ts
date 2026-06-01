import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function stageIdForStatus(status?: string): string | undefined {
  const map: Record<string, string | undefined> = {
    new: Deno.env.get("GHL_STAGE_NEW_ID"),
    contacted: Deno.env.get("GHL_STAGE_CONTACTED_ID"),
    quoted: Deno.env.get("GHL_STAGE_QUOTED_ID"),
    callback: Deno.env.get("GHL_STAGE_CALLBACK_ID"),
    negotiating: Deno.env.get("GHL_STAGE_NEGOTIATING_ID"),
    converted: Deno.env.get("GHL_STAGE_CONVERTED_ID"),
    lost: Deno.env.get("GHL_STAGE_LOST_ID"),
    fake_lead: Deno.env.get("GHL_STAGE_FAKE_LEAD_ID"),
  };
  return map[(status || "new").toLowerCase()];
}

function buildTags(input: any): string[] {
  const tags = new Set<string>(["buyawarranty"]);
  if (input.step_abandoned !== undefined && input.step_abandoned !== null && input.step_abandoned !== "") {
    tags.add(`step-${input.step_abandoned}`);
  }
  if (input.paid === true || input.payment_type) tags.add("paid");
  if (input.repeat_customer === true) tags.add("repeat-customer");
  if (input.suspicious === true) tags.add("suspicious");

  const src = String(input.lead_source || input.original_source || "").toLowerCase();
  if (input.gclid || src.includes("google")) tags.add("source-google");
  else if (input.fbclid || src.includes("facebook") || src.includes("social")) tags.add("source-facebook");
  else if (src.includes("organic") || src.includes("direct") || src.includes("website")) tags.add("source-organic");

  return Array.from(tags);
}

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
    { key: "plan_id", value: input.plan_id },
    { key: "plan_name", value: input.plan_name },
    { key: "payment_type", value: input.payment_type },
    { key: "total_price", value: input.total_price },
    { key: "voluntary_excess", value: input.voluntary_excess },
    { key: "claim_limit", value: input.claim_limit },
    { key: "warranty_duration", value: input.warranty_duration },
    { key: "step_abandoned", value: input.step_abandoned },
    { key: "lead_source", value: input.lead_source },
    { key: "original_source", value: input.original_source },
    { key: "priority", value: input.priority },
    { key: "fbclid", value: input.fbclid },
    { key: "gclid", value: input.gclid },
    { key: "utm_source", value: input.utm_source },
    { key: "utm_medium", value: input.utm_medium },
    { key: "utm_campaign", value: input.utm_campaign },
    { key: "assigned_agent", value: input.assigned_agent },
    { key: "last_activity_date", value: input.last_activity_date },
    { key: "notes_summary", value: input.notes_summary || input.notes },
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
    source: input.source || "buyawarranty - step 2",
    tags: buildTags(input),
    customFields,
  };
}

async function ghlFetch(path: string, apiKey: string, method: string, body?: any) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Version": GHL_VERSION,
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: text };
}

async function upsertContact(apiKey: string, payload: any): Promise<{ ok: boolean; status: number; body: string; contactId?: string }> {
  const r = await ghlFetch("/contacts/upsert", apiKey, "POST", payload);
  let contactId: string | undefined;
  try {
    const j = JSON.parse(r.body);
    contactId = j?.contact?.id || j?.id;
  } catch {}
  return { ...r, body: r.body.slice(0, 800), contactId };
}

async function upsertOpportunity(apiKey: string, input: any, contactId: string, locationId: string) {
  const pipelineId = Deno.env.get("GHL_PIPELINE_ID");
  if (!pipelineId) return null;
  const stageId = stageIdForStatus(input.status) || Deno.env.get("GHL_STAGE_NEW_ID");
  if (!stageId) return null;

  const body: any = {
    pipelineId,
    locationId,
    pipelineStageId: stageId,
    name: `${input.full_name || input.email || "Lead"}${input.vehicle_reg ? ` - ${input.vehicle_reg}` : ""}`,
    status: input.status === "lost" ? "lost" : input.status === "converted" ? "won" : "open",
    contactId,
    monetaryValue: input.total_price ? Number(input.total_price) : undefined,
    source: input.source || "buyawarranty",
  };
  // Use upsert endpoint (v2)
  return await ghlFetch("/opportunities/upsert", apiKey, "POST", body);
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
      result = await upsertContact(apiKey, payload);
    } catch (err: any) {
      result = { ok: false, status: 0, body: err?.message || "network_error" } as any;
    }

    if (result.ok) {
      console.log(`✅ GHL contact upserted for ${input.email}: ${result.body}`);

      // Best-effort opportunity upsert into pipeline
      if (result.contactId) {
        try {
          const opp = await upsertOpportunity(apiKey, input, result.contactId, locationId);
          if (opp && !opp.ok) {
            console.warn(`⚠️ GHL opportunity upsert failed (${opp.status}): ${opp.body.slice(0, 300)}`);
          } else if (opp) {
            console.log(`✅ GHL opportunity upserted for ${input.email}`);
          }
        } catch (e: any) {
          console.warn(`⚠️ GHL opportunity upsert error: ${e?.message || e}`);
        }
      }

      return new Response(JSON.stringify({ success: true, contactId: result.contactId }), {
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
