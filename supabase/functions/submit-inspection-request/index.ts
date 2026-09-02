import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : null);

const log = (step: string, data?: unknown) =>
  console.log(`[submit-inspection-request] ${step}${data ? " " + JSON.stringify(data) : ""}`);

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

    const username = Deno.env.get("WORLDPAY_USERNAME");
    const password = Deno.env.get("WORLDPAY_PASSWORD");
    const entityRef = Deno.env.get("WORLDPAY_ENTITY_REF");
    const env = (Deno.env.get("WORLDPAY_ENV") || "sandbox").toLowerCase();
    if (!username || !password || !entityRef) {
      throw new Error("Worldpay credentials not configured");
    }

    const primary = env === "live"
      ? "https://access.worldpay.com"
      : "https://try.access.worldpay.com";
    const secondary = env === "live"
      ? "https://try.access.worldpay.com"
      : "https://access.worldpay.com";

    const transactionReference = `BAW-INSP-${crypto.randomUUID()}`;
    const site = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";
    const fee = Number(reqRow.fee_amount) > 0 ? Number(reqRow.fee_amount) : 140;
    const reg = (reqRow.vehicle_registration || "").toUpperCase();

    const wpBody: Record<string, unknown> = {
      transactionReference,
      merchant: { entity: entityRef },
      narrative: { line1: "Buy A Warranty".slice(0, 24) },
      value: { currency: "GBP", amount: Math.round(fee * 100) },
      description: `Independent inspection${reg ? ` – ${reg}` : ""}`.slice(0, 128),
      resultURLs: {
        successURL: `${site}/independent-inspection/${reqRow.token}?paid=1&ref=${encodeURIComponent(transactionReference)}`,
        pendingURL: `${site}/independent-inspection/${reqRow.token}?paid=1&ref=${encodeURIComponent(transactionReference)}`,
        failureURL: `${site}/independent-inspection/${reqRow.token}?status=failed`,
        errorURL: `${site}/independent-inspection/${reqRow.token}?status=error`,
        cancelURL: `${site}/independent-inspection/${reqRow.token}?cancelled=1`,
        expiryURL: `${site}/independent-inspection/${reqRow.token}?status=expired`,
      },
    };

    const encodedCredentials = btoa(`${username}:${password}`);
    const authValues = [`Basic ${encodedCredentials}`, encodedCredentials];
    const hppContentType = "application/vnd.worldpay.payment_pages-v1.hal+json";

    const candidates = [`${primary}/payment_pages`, `${secondary}/payment_pages`];

    log("Calling Worldpay", { candidates, transactionReference, fee });

    let wpRes: Response | null = null;
    let wpText = "";
    let wpJson: any = {};
    let lastError = "";

    for (const url of Array.from(new Set(candidates))) {
      for (const authValue of authValues) {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: authValue,
            "Content-Type": hppContentType,
            Accept: hppContentType,
            "WP-CorrelationId": transactionReference,
            "User-Agent": "BuyAWarranty-Inspection/1.0",
          },
          body: JSON.stringify(wpBody),
        });
        const text = await res.text();
        if (res.ok) {
          wpRes = res;
          wpText = text;
          try { wpJson = JSON.parse(text); } catch { /* ignore */ }
          break;
        }
        log("Worldpay attempt failed", { url, status: res.status, authStyle: authValue.startsWith("Basic ") ? "basic-prefix" : "encoded-only", body: text.slice(0, 500) });
        lastError = `${res.status} ${text.slice(0, 300)}`;
      }
      if (wpRes) break;
    }

    if (!wpRes) {
      const denied = /accessDenied|Access to the requested resource has been denied|Invalid authentication/i.test(lastError);
      return new Response(JSON.stringify({
        error: denied
          ? "Worldpay Hosted Payment Pages access is denied for the saved merchant credentials"
          : "Worldpay request failed",
        details: denied
          ? "Worldpay accepted the request format but denied access to /payment_pages. Enable Hosted Payment Pages / Pay by Link for this merchant entity, or update WORLDPAY_USERNAME, WORLDPAY_PASSWORD and WORLDPAY_ENTITY_REF to credentials with HPP access."
          : lastError || "no endpoint reachable",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentUrl: string | undefined = wpJson?.url
      || wpJson?._links?.["payment_pages:url"]?.href;

    if (!paymentUrl) {
      log("No payment URL in response", wpJson);
      return new Response(JSON.stringify({ error: "Worldpay returned no payment URL", details: wpJson }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("worldpay_transactions").insert({
      customer_id: null,
      flow: "ecom",
      environment: env === "live" ? "live" : "sandbox",
      amount_pence: Math.round(fee * 100),
      currency: "GBP",
      description: `Independent inspection fee (${reqRow.vehicle_registration || "vehicle"})`,
      customer_email: reqRow.customer_email ?? null,
      worldpay_link_id: transactionReference,
      worldpay_link_url: paymentUrl,
      status: "pending",
      raw_response: wpJson,
    });

    return new Response(JSON.stringify({ success: true, checkout_url: paymentUrl }), {
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
