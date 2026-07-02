// Resend webhook — receives delivery events and updates admin_sent_quotes.
// Configure in Resend dashboard → Webhooks, pointing at this function URL.
// Subscribe to: email.sent, email.delivered, email.delivery_delayed,
// email.bounced, email.complained, email.opened, email.clicked, email.failed.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Map Resend event types → our delivery_status values.
const STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

// Order of finality — never overwrite a "worse" or later status with an earlier one.
const PRIORITY: Record<string, number> = {
  pending: 0,
  sent: 1,
  opened: 2,
  clicked: 3,
  delayed: 4,
  delivered: 5,
  bounced: 6,
  complained: 6,
  failed: 6,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) return new Response("bad payload", { status: 400, headers: corsHeaders });

    const type: string = payload.type || payload.event || "";
    const data = payload.data || {};
    const messageId: string | undefined = data.email_id || data.id;
    if (!messageId) return new Response(JSON.stringify({ ok: true, skip: "no id" }), { status: 200, headers: corsHeaders });

    const newStatus = STATUS_MAP[type];
    if (!newStatus) return new Response(JSON.stringify({ ok: true, skip: "unhandled type" }), { status: 200, headers: corsHeaders });

    // Fetch current row so we don't downgrade status.
    const { data: existing } = await supabase
      .from("admin_sent_quotes")
      .select("id, delivery_status, delivery_events")
      .eq("provider_message_id", messageId)
      .maybeSingle();

    if (!existing) {
      console.log("resend-webhook: no matching quote for", messageId, type);
      return new Response(JSON.stringify({ ok: true, matched: false }), { status: 200, headers: corsHeaders });
    }

    const currentPriority = PRIORITY[existing.delivery_status || "pending"] ?? 0;
    const nextPriority = PRIORITY[newStatus] ?? 0;

    const events = Array.isArray(existing.delivery_events) ? existing.delivery_events : [];
    events.push({ type, at: new Date().toISOString(), error: data.reason || data.error || null });

    const update: Record<string, unknown> = {
      delivery_events: events,
    };
    if (nextPriority >= currentPriority) {
      update.delivery_status = newStatus;
      update.delivery_status_at = new Date().toISOString();
      if (["bounced", "complained", "failed"].includes(newStatus)) {
        update.delivery_error = data.reason || data.bounce?.message || data.error || type;
      }
    }

    await supabase.from("admin_sent_quotes").update(update).eq("id", existing.id);

    return new Response(JSON.stringify({ ok: true, matched: true, applied: nextPriority >= currentPriority }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resend-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
