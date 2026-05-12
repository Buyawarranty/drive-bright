import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GHL_API_KEY");
  const locationId = Deno.env.get("GHL_LOCATION_ID");
  if (!apiKey || !locationId) {
    return new Response(JSON.stringify({ skipped: "no GHL_API_KEY/GHL_LOCATION_ID" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: rows, error } = await supabase
    .from("ghl_push_queue")
    .select("id, payload, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("retry-ghl-pushes select error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let requeued = 0;
  let failed = 0;

  for (const row of rows || []) {
    const attempts = (row.attempts || 0) + 1;
    let ok = false;
    let errMsg = "";
    let httpStatus = 0;
    try {
      const payload = { ...(row.payload || {}), locationId };
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
      httpStatus = res.status;
      const body = await res.text().catch(() => "");
      ok = res.ok;
      if (!ok) errMsg = `HTTP ${res.status}: ${body.slice(0, 300)}`;
    } catch (e: any) {
      errMsg = e?.message || "network_error";
    }

    if (ok) {
      await supabase
        .from("ghl_push_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts, last_error: null })
        .eq("id", row.id);
      sent++;
    } else if (attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("ghl_push_queue")
        .update({ status: "failed", attempts, last_error: errMsg })
        .eq("id", row.id);
      failed++;
    } else {
      const backoffMin = Math.pow(2, attempts);
      await supabase
        .from("ghl_push_queue")
        .update({
          attempts,
          last_error: errMsg,
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
        })
        .eq("id", row.id);
      requeued++;
    }
  }

  console.log(`retry-ghl-pushes: processed=${rows?.length || 0} sent=${sent} requeued=${requeued} failed=${failed}`);
  return new Response(JSON.stringify({ processed: rows?.length || 0, sent, requeued, failed }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
