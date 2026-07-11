// Worldpay Access webhook receiver
// Verifies signature and updates worldpay_transactions
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const log = (step: string, data?: unknown) =>
  console.log(`[worldpay-webhook] ${step}${data ? " " + JSON.stringify(data) : ""}`);

async function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  // Worldpay Access sends WP-Signature: hmacsha256=... or similar
  const provided = signatureHeader.replace(/^.*=/, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === provided;
}

function mapStatus(eventType: string): string | null {
  const e = (eventType || "").toLowerCase();
  if (e.includes("authorized") || e.includes("authorised")) return "authorised";
  if (e.includes("settled") || e.includes("captured") || e.includes("charged")) return "captured";
  if (e.includes("refused") || e.includes("failed") || e.includes("error")) return "failed";
  if (e.includes("cancelled") || e.includes("canceled") || e.includes("expired")) return "cancelled";
  if (e.includes("refunded")) return "refunded";
  return null;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const raw = await req.text();
    const secret = Deno.env.get("WORLDPAY_WEBHOOK_SECRET");
    const sigHeader = req.headers.get("wp-signature") || req.headers.get("WP-Signature");

    if (secret) {
      const ok = await verifySignature(raw, sigHeader, secret);
      if (!ok) {
        log("Signature verification failed");
        return new Response("Invalid signature", { status: 401 });
      }
    } else {
      log("No WORLDPAY_WEBHOOK_SECRET configured — accepting without verification");
    }

    const payload = JSON.parse(raw);
    log("Event received", payload);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const transactionReference: string | undefined =
      payload?.eventDetails?.transactionReference
      || payload?.transactionReference
      || payload?.eventDetails?.transactionReferences?.[0];

    const eventType: string = payload?.eventDetails?.type || payload?.eventType || "";
    const status = mapStatus(eventType);
    const paymentId: string | undefined = payload?.eventDetails?.paymentId || payload?.paymentId;

    if (!transactionReference) {
      log("No transactionReference in payload");
      return new Response("ok", { status: 200 });
    }

    const patch: Record<string, unknown> = {
      last_event: eventType,
      raw_response: payload,
    };
    if (status) patch.status = status;
    if (paymentId) patch.worldpay_payment_id = paymentId;

    const { error } = await admin
      .from("worldpay_transactions")
      .update(patch)
      .eq("worldpay_link_id", transactionReference);

    if (error) {
      log("DB update error", error);
      return new Response("db error", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    log("Unexpected error", err?.message);
    return new Response("error", { status: 500 });
  }
});
