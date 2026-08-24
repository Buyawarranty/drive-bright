import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token, sessionId } = await req.json();
    if (!token || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing token or sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reqRow } = await supabase
      .from("claim_inspection_requests")
      .select("id, claim_id, paid_at, inspection_company, vehicle_registration, customer_name")
      .eq("token", token)
      .maybeSingle();

    if (!reqRow) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reqRow.paid_at) {
      return new Response(JSON.stringify({ success: true, alreadyPaid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ success: false, error: "not_paid" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("claim_inspection_requests")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: (session.amount_total || 0) / 100,
        stripe_session_id: session.id,
      })
      .eq("id", reqRow.id);

    // Timeline note on the claim
    await supabase.from("claim_notes").insert({
      claim_id: reqRow.claim_id,
      note: `Independent inspection paid (£${((session.amount_total || 0) / 100).toFixed(2)}) — assigned to ${reqRow.inspection_company}. Customer accepted the decision as full and final. Average turnaround 7–14 working days.`,
      author_name: "System",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("confirm-inspection-payment error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
