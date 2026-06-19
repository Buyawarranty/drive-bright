// One-off admin tool: refund a customer via Stripe and mark them cancelled.
// POST { customerId: string, reason?: string }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req, { allowedRoles: ["admin", "super_admin"] });
  if (!auth.ok) return auth.response;


  try {
    const { customerId, reason = "Price manipulation - £1 fraud refund" } = await req.json();
    if (!customerId) {
      return new Response(JSON.stringify({ error: "customerId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("id, email, name, final_amount, stripe_session_id, status")
      .eq("id", customerId)
      .maybeSingle();

    if (cErr || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found", details: cErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });

    // stripe_session_id field actually contains either a cs_ or pi_ id
    const ref = customer.stripe_session_id || "";
    let paymentIntentId: string | null = null;

    if (ref.startsWith("pi_")) {
      paymentIntentId = ref;
    } else if (ref.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(ref);
      paymentIntentId = (session.payment_intent as string) || null;
    }

    let refund: any = null;
    if (paymentIntentId) {
      refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: "fraudulent",
        metadata: { customer_id: customerId, admin_reason: reason },
      });
    }

    // Mark customer as cancelled / refunded
    const { error: uErr } = await supabase
      .from("customers")
      .update({
        status: "Cancelled",
        cancellation_note: `${reason} | Stripe refund: ${refund?.id || "no PI found"} | ${new Date().toISOString()}`,
        cancellation_note_updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    // Also mark related policies cancelled
    await supabase
      .from("customer_policies")
      .update({ status: "cancelled" })
      .eq("customer_id", customerId);

    return new Response(JSON.stringify({
      success: true,
      customer: { id: customer.id, email: customer.email, name: customer.name, amount: customer.final_amount },
      paymentIntentId,
      refund: refund ? { id: refund.id, amount: refund.amount, status: refund.status } : null,
      dbUpdateError: uErr?.message ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
