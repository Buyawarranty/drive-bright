import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FacebookLeadPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  vehicle_reg?: string;
  source?: string;
  campaign_name?: string;
  form_name?: string;
  created_time?: string;
}

function splitName(full?: string): { first: string; last: string } {
  if (!full) return { first: "", last: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function normalizeEmail(e?: string) {
  return (e || "").trim().toLowerCase();
}

function normalizePhone(p?: string) {
  return (p || "").replace(/\s+/g, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require a shared secret header so only trusted senders (our FB Lead Ads
  // bridge / Zapier / Make.com) can post leads. Without this, anyone with the
  // URL could flood sales_leads with arbitrary rows via the service role.
  const expectedSecret = Deno.env.get("FACEBOOK_WEBHOOK_SECRET");
  const providedSecret =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("X-Webhook-Secret") ||
    "";
  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.warn("[capture-facebook-lead] Rejected: missing/invalid webhook secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as FacebookLeadPayload;
    console.log("[capture-facebook-lead] payload received");


    const email = normalizeEmail(body.email);
    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { first, last } = splitName(body.full_name);
    const phone = normalizePhone(body.phone);
    const vehicleReg = (body.vehicle_reg || "").toUpperCase().replace(/\s+/g, "");
    const campaign = body.campaign_name || "";
    const formName = body.form_name || "Instant Leads FB";

    const noteParts = [
      `Source: Facebook Lead Ads`,
      campaign ? `Campaign: ${campaign}` : null,
      `Form: ${formName}`,
      body.created_time ? `FB Created: ${body.created_time}` : null,
    ].filter(Boolean);

    // Dedup: match on normalized email or phone
    const { data: existing } = await supabase
      .from("sales_leads")
      .select("id")
      .or(`email.eq.${email}${phone ? `,phone.eq.${phone}` : ""}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log("[capture-facebook-lead] duplicate, updating:", existing.id);
      await supabase
        .from("sales_leads")
        .update({
          first_name: first || undefined,
          last_name: last || undefined,
          phone: phone || undefined,
          vehicle_reg: vehicleReg || undefined,
          last_activity_date: new Date().toISOString(),
          notes: noteParts.join(" | "),
        })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({ ok: true, lead_id: existing.id, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: inserted, error } = await supabase
      .from("sales_leads")
      .insert({
        first_name: first,
        last_name: last,
        email,
        phone: phone || null,
        vehicle_reg: vehicleReg || null,
        lead_source: "social_ad",
        original_source: "facebook_lead_ads",
        status: "new",
        priority: "medium",
        notes: noteParts.join(" | "),
        last_activity_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[capture-facebook-lead] insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[capture-facebook-lead] created lead:", inserted.id);
    return new Response(
      JSON.stringify({ ok: true, lead_id: inserted.id, duplicate: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[capture-facebook-lead] error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
