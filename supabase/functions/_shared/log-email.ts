// Shared helper to log every customer-facing email to public.email_logs.
// Use this from any edge function that sends a customer email so the unified
// "Customer Emails" view in the admin Emails tab can display it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

export type CustomerEmailStatus = "sent" | "failed" | "pending" | "bounced" | "complained";

export interface LogCustomerEmailParams {
  recipient_email: string;
  subject: string;
  /** Short identifier of the email kind, e.g. "welcome", "policy_documents", "abandoned_cart_step1" */
  template_name?: string;
  /** Which edge function issued the send (auto-populates the source filter in the UI) */
  source_function: string;
  status: CustomerEmailStatus;
  error_message?: string | null;
  recipient_name?: string | null;
  customer_id?: string | null;
  policy_number?: string | null;
  registration_plate?: string | null;
  /** Anything else worth keeping — Resend id, plan name, payment ref, etc. */
  metadata?: Record<string, unknown>;
}

let cachedClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

/**
 * Best-effort log. Never throws — logging failures must not break the send flow.
 */
export async function logCustomerEmail(params: LogCustomerEmailParams): Promise<void> {
  try {
    const supabase = getServiceClient();
    const nowIso = new Date().toISOString();
    const metadata = {
      ...(params.metadata ?? {}),
      source_function: params.source_function,
      registration_plate: params.registration_plate ?? null,
      policy_number: params.policy_number ?? null,
      template_name: params.template_name ?? null,
    };

    await supabase.from("email_logs").insert({
      recipient_email: params.recipient_email,
      recipient_name: params.recipient_name ?? null,
      subject: params.subject,
      status: params.status,
      delivery_status: params.status,
      error_message: params.error_message ?? null,
      failed_reason: params.status === "failed" ? params.error_message ?? null : null,
      sent_at: params.status === "sent" ? nowIso : null,
      customer_id: params.customer_id ?? null,
      metadata,
    });
  } catch (err) {
    console.error("logCustomerEmail failed", err);
  }
}
