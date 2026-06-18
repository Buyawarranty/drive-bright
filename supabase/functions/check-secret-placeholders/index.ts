import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECRETS = [
  "BREVO_API_KEY", "BREVO_MA_KEY",
  "CLICKSEND_API_KEY", "CLICKSEND_USERNAME",
  "GETADDRESS_API_KEY",
  "MOT_API_KEY", "MOT_CLIENT_ID", "MOT_CLIENT_SECRET", "MOT_SCOPE_URL", "MOT_TOKEN_URL",
  "PAYMENT_ASSIST_API_KEY", "PAYMENT_ASSIST_SECRET_KEY",
  "RESEND_API_KEY",
  "STRIPE_PUBLISHABLE_KEY", "VITE_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY",
  "TRUSTPILOT_API_KEY", "TRUSTPILOT_BUSINESS_UNIT_ID",
  "UCHAT_WEBHOOK_URL",
  
  "BUMPER_API_KEY", "BUMPER_SECRET_KEY",
];

function classify(name: string, v: string | undefined) {
  if (!v) return { status: "missing", len: 0, hint: "" };
  const t = v.trim();
  if (!t) return { status: "empty", len: 0, hint: "" };
  if (/placeholder|to.?be.?replaced|your.?api.?key|xxxx|todo|example|changeme/i.test(t))
    return { status: "PLACEHOLDER", len: t.length, hint: t.slice(0, 12) + "…" };
  if (t.length < 10) return { status: "too_short", len: t.length, hint: t.slice(0, 4) + "…" };
  return { status: "ok", len: t.length, hint: t.slice(0, 4) + "…" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const results: Record<string, any> = {};
  for (const s of SECRETS) results[s] = classify(s, Deno.env.get(s));
  const suspect = Object.entries(results).filter(([_, r]) => ["PLACEHOLDER", "missing", "empty", "too_short"].includes(r.status));
  return new Response(JSON.stringify({ suspect: Object.fromEntries(suspect), all: results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
