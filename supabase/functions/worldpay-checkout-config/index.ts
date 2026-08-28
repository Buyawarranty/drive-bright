// Public config for the custom Worldpay card form on the independent inspection page.
// Returns the browser-safe checkout ID (Worldpay Checkout SDK) so card data goes
// straight from the customer's browser to Worldpay (SAQ-A).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string" || token.length > 200) {
      return json({ available: false, reason: "invalid_token" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: reqRow } = await admin
      .from("claim_inspection_requests")
      .select("id, paid_at, status, fee_amount")
      .eq("token", token)
      .maybeSingle();

    if (!reqRow) return json({ available: false, reason: "not_found" });
    if (reqRow.paid_at || reqRow.status === "paid") {
      return json({ available: false, reason: "already_paid" });
    }

    const checkoutId = Deno.env.get("WORLDPAY_CHECKOUT_ID") || "";
    const env = (Deno.env.get("WORLDPAY_ENV") || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";

    if (!checkoutId || checkoutId === "PENDING") {
      return json({ available: false, reason: "checkout_id_not_configured" });
    }

    return json({
      available: true,
      checkoutId,
      environment: env,
      amountPence: Math.round(Number(reqRow.fee_amount || 140) * 100),
      currency: "GBP",
    });
  } catch (err: any) {
    return json({ available: false, reason: err?.message || "error" });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
