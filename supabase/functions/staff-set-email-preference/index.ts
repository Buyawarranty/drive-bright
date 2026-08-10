import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  try {
    // ---- Auth: caller must be an active staff member ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: staff } = await admin
      .from("admin_users")
      .select("id, first_name, last_name, email, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (!staff || staff.is_active === false) {
      return json({ error: "Only active staff can change email preferences" }, 403);
    }

    const staffName =
      [staff.first_name, staff.last_name].filter(Boolean).join(" ") ||
      staff.email ||
      userRes.user.email ||
      null;

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const frequency = String(body?.frequency ?? "");
    const reason = body?.reason ? String(body.reason) : null;
    const source = body?.source ? String(body.source) : "staff_unsubscribe";
    const customerName = body?.customerName ? String(body.customerName) : null;
    const vehicleReg = body?.vehicleReg ? String(body.vehicleReg) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email address" }, 400);
    if (!["all", "essentials", "off"].includes(frequency)) return json({ error: "Invalid frequency" }, 400);

    const isSubscribed = frequency !== "off";
    const now = new Date().toISOString();

    // ---- marketing_audience ----
    const { data: existing } = await admin
      .from("marketing_audience")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("marketing_audience")
        .update({ is_subscribed: isSubscribed, unsubscribed_at: isSubscribed ? null : now, frequency })
        .eq("email", email);
      if (error) throw error;
    } else {
      const { error } = await admin.from("marketing_audience").insert({
        email,
        is_subscribed: isSubscribed,
        unsubscribed_at: isSubscribed ? null : now,
        frequency,
        source,
      });
      if (error) throw error;
    }

    // ---- email_unsubscribes blocklist ----
    if (frequency === "off") {
      const { error } = await admin.from("email_unsubscribes").upsert(
        {
          email,
          reason: reason || "Staff unsubscribed the customer",
          source,
          customer_name: customerName,
          vehicle_reg: vehicleReg,
          unsubscribed_by: staff.id,
          unsubscribed_by_name: staffName,
          frequency,
        },
        { onConflict: "email" }
      );
      if (error) throw error;
    } else {
      const { error } = await admin.from("email_unsubscribes").delete().eq("email", email);
      if (error) throw error;
    }

    return json({ success: true, email, frequency });
  } catch (error: any) {
    console.error("staff-set-email-preference error:", error);
    return json({ error: error?.message || "Unexpected error" }, 500);
  }
});
