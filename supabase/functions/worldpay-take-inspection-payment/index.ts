// Take the £140 independent-inspection payment via Worldpay Access Payments API
// using a browser-created card session (Worldpay Checkout SDK). Fully custom card
// form — no hosted payment page.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  token: z.string().trim().min(8).max(200),
  sessionHref: z.string().trim().url().max(500),
  cardHolderName: z.string().trim().min(1).max(100),
  deviceData: z.record(z.unknown()).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    const body = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: reqRow } = await admin
      .from("claim_inspection_requests")
      .select("id, claim_id, token, customer_name, customer_email, vehicle_registration, inspection_company, fee_amount, status, paid_at")
      .eq("token", body.token)
      .maybeSingle();

    if (!reqRow) return json({ error: "Link not found" }, 404);
    if (reqRow.paid_at || reqRow.status === "paid") {
      return json({ outcome: "already_paid" });
    }

    const username = Deno.env.get("WORLDPAY_USERNAME");
    const password = Deno.env.get("WORLDPAY_PASSWORD");
    const entityRef = Deno.env.get("WORLDPAY_ENTITY_REF");
    const env = (Deno.env.get("WORLDPAY_ENV") || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
    if (!username || !password || !entityRef) {
      return json({ error: "Worldpay not configured", fallback: true }, 500);
    }

    const host = env === "live" ? "https://access.worldpay.com" : "https://try.access.worldpay.com";
    const site = "https://buyawarranty.co.uk";
    const transactionReference = `BAW-INSP-${crypto.randomUUID()}`;
    const amountPence = Math.round(Number(reqRow.fee_amount || 140) * 100);
    const challengeReturnUrl = `${site}/independent-inspection/${reqRow.token}?wp3ds=1&ref=${encodeURIComponent(transactionReference)}`;

    const paymentBody: Record<string, unknown> = {
      transactionReference,
      merchant: { entity: entityRef },
      narrative: { line1: "Buy A Warranty".slice(0, 24) },
      value: { currency: "GBP", amount: amountPence },
      description: "Independent inspection fee",
      paymentInstrument: {
        type: "card/checkout",
        sessionHref: body.sessionHref,
        cardHolderName: body.cardHolderName,
      },
      threeDS: {
        type: "integrated",
        challengeReturnUrl,
        challengeWindowSize: "fullPage",
        deviceData: body.deviceData || undefined,
      },
    };

    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    const paymentsContentType = "application/vnd.worldpay.payments-v6+json";

    const wpRes = await fetch(`${host}/payments`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": paymentsContentType,
        Accept: paymentsContentType,
        "WP-CorrelationId": transactionReference,
        "User-Agent": "BuyAWarranty-Inspection/1.0",
      },
      body: JSON.stringify(paymentBody),
    });

    const wpText = await wpRes.text();
    let wpJson: any = {};
    try { wpJson = JSON.parse(wpText); } catch { /* non-json */ }

    if (!wpRes.ok) {
      const denied = /accessDenied|denied|Invalid authentication/i.test(wpText);
      console.log("[worldpay-take-inspection-payment] Worldpay error", wpRes.status, wpText.slice(0, 400));
      return json({
        error: denied
          ? "Worldpay Payments API access is not enabled for this merchant account"
          : (wpJson?.message || "Payment could not be processed"),
        outcome: "error",
        fallback: true,
      }, 502);
    }

    const outcome: string = wpJson?.outcome || "unknown";

    // Record the attempt
    await admin.from("worldpay_transactions").insert({
      customer_id: null,
      flow: "ecom",
      environment: env,
      amount_pence: amountPence,
      currency: "GBP",
      description: `Independent inspection fee (${reqRow.vehicle_registration || "vehicle"})`,
      customer_email: reqRow.customer_email ?? null,
      worldpay_link_id: transactionReference,
      worldpay_link_url: null,
      status: outcome === "authorized" || outcome === "sentForSettlement" ? "paid" : outcome,
      raw_response: wpJson,
    });

    const extract3ds = () => {
      const links = wpJson?._links || {};
      const dev = links["3ds:deviceDataCollection"] || {};
      const ch = links["3ds:challenge"] || {};
      const three = wpJson?.threeDS || {};
      return {
        deviceDataUrl: dev.href || three?.deviceDataCollection?.url || null,
        deviceDataJwt: dev.jwt || three?.deviceDataCollection?.jwt || null,
        deviceDataBin: three?.deviceDataCollection?.bin || wpJson?.paymentInstrument?.cardBin || null,
        challengeUrl: ch.href || three?.challenge?.url || null,
        challengeJwt: ch.jwt || three?.challenge?.jwt || null,
        challengeReference: three?.challenge?.reference || null,
      };
    };

    if (outcome === "authorized" || outcome === "sentForSettlement") {
      await markPaid(admin, reqRow, transactionReference, amountPence);
      return json({ outcome: "authorized", transactionReference });
    }

    if (outcome === "3dsDeviceDataRequired" || outcome === "3dsChallenged") {
      return json({ outcome, transactionReference, threeDS: extract3ds() });
    }

    // refused / fraudHighRisk / unknown
    return json({
      outcome,
      error: outcome === "refused"
        ? "Your card was declined. Please try a different card."
        : "Payment could not be completed. Please try another card or the secure payment page.",
    }, 402);
  } catch (err: any) {
    console.log("[worldpay-take-inspection-payment] error", err?.message);
    return json({ error: err?.message || "Internal error", fallback: true }, 500);
  }
});

async function markPaid(admin: any, reqRow: any, transactionReference: string, amountPence: number) {
  await admin
    .from("claim_inspection_requests")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid: amountPence / 100,
    })
    .eq("id", reqRow.id);

  await admin.from("claim_notes").insert({
    claim_id: reqRow.claim_id,
    note: `Independent inspection paid (£${(amountPence / 100).toFixed(2)}) via Worldpay (${transactionReference}) — assigned to ${reqRow.inspection_company}. Customer accepted the decision as full and final. Average turnaround 7–14 working days.`,
    created_by_name: "System",
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
