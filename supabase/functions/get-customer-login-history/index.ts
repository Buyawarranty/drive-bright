import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // Caller must be staff (admin_users active row)
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id, role, is_active")
      .eq("user_id", callerId)
      .eq("is_active", true)
      .maybeSingle();
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const customer_id = body.customer_id ?? null;
    if (!email && !customer_id) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Our own attempts table
    let q = admin
      .from("customer_login_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (customer_id) q = q.or(`customer_id.eq.${customer_id},email.ilike.${email}`);
    else q = q.ilike("email", email);
    const { data: ourRows, error: ourErr } = await q;
    if (ourErr) throw ourErr;

    // Supabase auth audit log entries for the email (via auth.users join)
    let supabaseAuthEvents: any[] = [];
    try {
      const { data: authUser } = await admin
        .from("auth.users" as any)
        .select("id,email,last_sign_in_at,created_at,confirmed_at")
        .ilike("email", email)
        .maybeSingle();
      if (authUser?.id) {
        const { data: audit } = await admin
          .from("auth.audit_log_entries" as any)
          .select("id,payload,created_at,ip_address")
          .eq("instance_id", "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: false })
          .limit(100);
        if (Array.isArray(audit)) {
          supabaseAuthEvents = audit
            .filter((r: any) =>
              JSON.stringify(r?.payload || {}).toLowerCase().includes(email),
            )
            .map((r: any) => ({
              id: `auth-${r.id}`,
              source: "supabase_auth",
              event_type: r?.payload?.action || "auth_event",
              success: r?.payload?.action ? !String(r.payload.action).includes("fail") : true,
              email,
              ip_address: r.ip_address ?? r?.payload?.ip_address ?? null,
              user_agent: null,
              failure_reason: null,
              metadata: r.payload || {},
              created_at: r.created_at,
            }));
        }
      }
    } catch (e) {
      console.warn("auth audit fetch failed", (e as Error).message);
    }

    const ours = (ourRows || []).map((r: any) => ({ ...r, source: "app" }));
    const merged = [...ours, ...supabaseAuthEvents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return new Response(JSON.stringify({ events: merged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-customer-login-history error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
