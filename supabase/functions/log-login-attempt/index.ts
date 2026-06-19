import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENTS = new Set([
  "login_success",
  "login_failed",
  "password_reset_requested",
  "credentials_resent",
  "admin_password_reset",
  "admin_impersonate",
  "admin_magic_link",
  "admin_details_edited",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const event_type = String(body.event_type || "");
    if (!email || !ALLOWED_EVENTS.has(event_type)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const ua = req.headers.get("user-agent") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to attach customer_id (best-effort, by email).
    let customer_id: string | null = body.customer_id ?? null;
    if (!customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      customer_id = data?.id ?? null;
    }

    const { error } = await supabase.from("customer_login_attempts").insert({
      email,
      customer_id,
      event_type,
      success: !!body.success,
      failure_reason: body.failure_reason ? String(body.failure_reason).slice(0, 500) : null,
      ip_address: ip,
      user_agent: ua,
      triggered_by_admin_id: body.triggered_by_admin_id ?? null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-login-attempt error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
