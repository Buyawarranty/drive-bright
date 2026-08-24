import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : null);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const token = str(body.token, 200);
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.acceptedTerms !== true) {
      return new Response(JSON.stringify({ error: "You must accept the inspection terms" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reqRow, error: fetchError } = await supabase
      .from("claim_inspection_requests")
      .select("id, token, customer_name, customer_email, vehicle_registration, inspection_company, fee_amount, status, paid_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (fetchError || !reqRow) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(reqRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reqRow.paid_at) {
      return new Response(JSON.stringify({ error: "already_paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mileageRaw = Number(body.currentMileage);
    const update = {
      garage_name: str(body.garageName, 200),
      garage_contact: str(body.garageContact, 200),
      garage_phone: str(body.garagePhone, 40),
      garage_address: str(body.garageAddress, 400),
      vehicle_location: str(body.vehicleLocation, 400),
      current_mileage: Number.isFinite(mileageRaw) && mileageRaw > 0 ? Math.round(mileageRaw) : null,
      availability_notes: str(body.availabilityNotes, 1000),
      additional_notes: str(body.additionalNotes, 1000),
      accepted_terms: true,
      accepted_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      status: "awaiting_payment",
    };

    const { error: updateError } = await supabase
      .from("claim_inspection_requests")
      .update(update)
      .eq("id", reqRow.id);

    if (updateError) throw new Error(updateError.message);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const siteUrl = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";
    const fee = Number(reqRow.fee_amount) > 0 ? Number(reqRow.fee_amount) : 140;
    const reg = (reqRow.vehicle_registration || "").toUpperCase();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: reqRow.customer_email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(fee * 100),
            product_data: {
              name: `Independent inspection${reg ? ` – ${reg}` : ""}`,
              description: `Independent engineer inspection carried out by ${reqRow.inspection_company}. Decision is full and final.`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        inspection_request_id: reqRow.id,
        inspection_company: reqRow.inspection_company,
        registration_plate: reg,
        type: "independent_inspection",
      },
      success_url: `${siteUrl}/independent-inspection/${reqRow.token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/independent-inspection/${reqRow.token}?cancelled=1`,
    });

    await supabase
      .from("claim_inspection_requests")
      .update({ stripe_session_id: session.id })
      .eq("id", reqRow.id);

    return new Response(JSON.stringify({ success: true, checkout_url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("submit-inspection-request error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
