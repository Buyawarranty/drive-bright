import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const resend = new Resend(resendKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: rows, error } = await supabase
    .from("claim_email_retry_queue")
    .select("id, email_kind, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("retry-claim-emails select error:", error);
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
    const maxAttempts = row.max_attempts || 6;
    let ok = false;
    let errMsg = "";
    try {
      const res: any = await resend.emails.send(row.payload as any);
      if (res?.error) {
        errMsg = typeof res.error === "string" ? res.error : JSON.stringify(res.error);
      } else {
        ok = true;
      }
    } catch (e: any) {
      errMsg = e?.message || String(e);
    }

    if (ok) {
      await supabase
        .from("claim_email_retry_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts, last_error: null })
        .eq("id", row.id);
      sent++;
    } else if (attempts >= maxAttempts) {
      await supabase
        .from("claim_email_retry_queue")
        .update({ status: "failed", attempts, last_error: errMsg.slice(0, 2000) })
        .eq("id", row.id);
      failed++;
      console.error(`retry-claim-emails: giving up on ${row.id} (${row.email_kind}): ${errMsg}`);
    } else {
      const backoffMin = Math.min(60, Math.pow(2, attempts)); // 2,4,8,16,32,60 min cap
      await supabase
        .from("claim_email_retry_queue")
        .update({
          attempts,
          last_error: errMsg.slice(0, 2000),
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
        })
        .eq("id", row.id);
      requeued++;
    }
  }

  console.log(`retry-claim-emails: processed=${rows?.length || 0} sent=${sent} requeued=${requeued} failed=${failed}`);
  return new Response(
    JSON.stringify({ processed: rows?.length || 0, sent, requeued, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
