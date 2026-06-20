// Nightly (and on-demand) snapshot of per-agent lead activity into agent_daily_lead_stats.
// Called by pg_cron at 00:01 Europe/London for the previous day, and on-demand by
// management via the "Rebuild day" button for any historical date.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ukYesterdayISO(): string {
  // Compute "yesterday" in Europe/London regardless of server TZ.
  const now = new Date();
  const ukDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD today UK
  const d = new Date(`${ukDateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional override from caller (management can rebuild a specific date).
    // Body: { date?: "YYYY-MM-DD" }
    let targetDate = ukYesterdayISO();
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          targetDate = body.date;

          // If a caller-supplied date, require management role.
          const authHeader = req.headers.get("Authorization") || "";
          const jwt = authHeader.replace("Bearer ", "");
          if (jwt) {
            const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
              global: { headers: { Authorization: `Bearer ${jwt}` } },
            });
            const { data: { user } } = await userClient.auth.getUser();
            if (!user) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            const { data: isMgmt } = await supabase.rpc("is_management", { _user_id: user.id });
            if (!isMgmt) {
              return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }
      } catch { /* no body — use yesterday */ }
    }

    const { data, error } = await supabase.rpc("snapshot_agent_daily_stats", { p_date: targetDate });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, date: targetDate, rows: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("snapshot-agent-daily-stats error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
