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

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
}

function deviceType(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "Tablet";
  if (/mobile|iphone|android/.test(s)) return "Mobile";
  return "Desktop";
}

async function geolocate(ip: string) {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.error) return null;
    return {
      city: d.city ?? null,
      region: d.region ?? null,
      country: d.country_name ?? null,
      country_code: d.country_code ?? null,
      timezone: d.timezone ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      isp: d.org ?? null,
    };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, user_id, email, is_active")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) return json({ error: "Not a staff account" }, 403);

    const ip = clientIp(req);
    if (!ip) return json({ ok: false, reason: "no-ip" });

    const ua = req.headers.get("user-agent") || "";
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from("staff_work_locations")
      .select("id, ping_count")
      .eq("admin_user_id", adminUser.id)
      .eq("session_date", today)
      .eq("ip_address", ip)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("staff_work_locations")
        .update({
          ping_count: (existing.ping_count ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
          user_agent: ua,
        })
        .eq("id", existing.id);
      return json({ ok: true, updated: true });
    }

    const geo = await geolocate(ip);
    const isp = geo?.isp ?? null;
    const isVpn = !!isp && /vpn|proxy|hosting|datacenter|digitalocean|amazon|google llc|ovh|linode|azure/i.test(isp);

    const { error: insertError } = await supabase.from("staff_work_locations").insert({
      admin_user_id: adminUser.id,
      user_id: adminUser.user_id,
      email: adminUser.email,
      session_date: today,
      ip_address: ip,
      user_agent: ua,
      device_type: deviceType(ua),
      is_vpn: isVpn,
      ...(geo ?? {}),
    });

    if (insertError) return json({ ok: false, error: insertError.message }, 500);
    return json({ ok: true, created: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
