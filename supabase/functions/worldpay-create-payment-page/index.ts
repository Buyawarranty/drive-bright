// Worldpay Access — create Hosted Payment Page
// Used for both Virtual Terminal (channel=moto) and Pay-by-Link (channel=ecom)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (step: string, data?: unknown) =>
  console.log(`[worldpay-create-payment-page] ${step}${data ? " " + JSON.stringify(data) : ""}`);

const BodySchema = z.object({
  flow: z.enum(["moto", "link"]),
  amount_pence: z.number().int().positive().max(10_000_00),
  description: z.string().trim().min(1).max(200).default("Vehicle warranty payment"),
  sales_lead_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  customer_email: z.string().email().max(255).optional().nullable(),
  customer_phone: z.string().max(30).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await admin.rpc("is_admin_or_sales", { _user_id: userId });
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    const username = Deno.env.get("WORLDPAY_USERNAME");
    const password = Deno.env.get("WORLDPAY_PASSWORD");
    const entityRef = Deno.env.get("WORLDPAY_ENTITY_REF");
    const env = (Deno.env.get("WORLDPAY_ENV") || "sandbox").toLowerCase();
    if (!username || !password || !entityRef) {
      return json({ error: "Worldpay credentials not configured" }, 500);
    }

    const primary = env === "live"
      ? "https://access.worldpay.com"
      : "https://try.access.worldpay.com";
    const secondary = env === "live"
      ? "https://try.access.worldpay.com"
      : "https://access.worldpay.com";

    const transactionReference = `BAW-${crypto.randomUUID()}`;
    const site = "https://buyawarranty.co.uk";

    const wpBody: Record<string, unknown> = {
      transactionReference,
      merchant: { entity: entityRef },
      narrative: { line1: "Buy A Warranty".slice(0, 24) },
      value: { currency: "GBP", amount: body.amount_pence },
      description: (body.description || "Vehicle warranty payment").slice(0, 128),
      resultURLs: {
        successURL: `${site}/payment-received`,
        pendingURL: `${site}/payment-received`,
        failureURL: `${site}/payment-received?status=failed`,
        errorURL: `${site}/payment-received?status=error`,
        cancelURL: `${site}/payment-received?status=cancelled`,
        expiryURL: `${site}/payment-received?status=expired`,
      },
    };

    const authValue = `Basic ${btoa(`${username}:${password}`)}`;
    const hppContentType = "application/vnd.worldpay.payment_pages-v1.hal+json";

    // Hosted Payment Pages API: POST /payment_pages (snake_case). Try the configured
    // environment first, then the other host in case credentials belong there.
    const candidates = [`${primary}/payment_pages`, `${secondary}/payment_pages`];

    log("Calling Worldpay", { candidates, transactionReference, flow: body.flow });

    let wpRes: Response | null = null;
    let wpText = "";
    let wpJson: any = {};
    let lastError = "";

    for (const url of Array.from(new Set(candidates))) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authValue,
          "Content-Type": hppContentType,
          Accept: hppContentType,
          "WP-CorrelationId": transactionReference,
          "User-Agent": "BuyAWarranty-Admin/1.0",
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
      log("Worldpay attempt failed", { url, status: res.status, body: text.slice(0, 500) });
      lastError = `${res.status} ${text.slice(0, 300)}`;
      // Only keep trying while the endpoint itself is wrong; real rejections stop here.
      if (res.status !== 404) {
        return json({ error: "Worldpay request failed", status: res.status, details: text }, 502);
      }
    }

    if (!wpRes) {
      return json({ error: `Worldpay request failed: ${lastError || "no endpoint reachable"}` }, 502);
    }


    const paymentUrl: string | undefined = wpJson?.url
      || wpJson?._links?.["payment_pages:url"]?.href;

    if (!paymentUrl) {
      log("No payment URL in response", wpJson);
      return json({ error: "Worldpay returned no payment URL", details: wpJson }, 502);
    }

    const { data: txRow, error: insertErr } = await admin
      .from("worldpay_transactions")
      .insert({
        sales_lead_id: body.sales_lead_id ?? null,
        customer_id: body.customer_id ?? null,
        admin_user_id: userId,
        flow: body.flow,
        environment: env === "live" ? "live" : "sandbox",
        amount_pence: body.amount_pence,
        currency: "GBP",
        description: body.description,
        customer_email: body.customer_email ?? null,
        customer_phone: body.customer_phone ?? null,
        worldpay_link_id: transactionReference,
        worldpay_link_url: paymentUrl,
        status: "pending",
        raw_response: wpJson,
      })
      .select("id")
      .single();

    if (insertErr) log("DB insert error", insertErr);

    return json({
      transaction_id: txRow?.id,
      transaction_reference: transactionReference,
      payment_url: paymentUrl,
      environment: env,
    }, 200);
  } catch (err: any) {
    log("Unexpected error", err?.message);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
