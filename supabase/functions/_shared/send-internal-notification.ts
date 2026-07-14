// Shared helper for sending internal (@buyawarranty.co.uk) team notification
// emails via Resend with:
//   - a dedicated sender domain (notify.buyawarranty.co.uk) to bypass
//     Microsoft 365 / Google Workspace "self-to-self" anti-spoof rules that
//     silently quarantine mail sent FROM buyawarranty.co.uk TO the same domain
//   - automatic retry with exponential backoff on transient failures
//   - full logging of every attempt (message id, provider response, errors)
//     into public.email_logs so bounces/failures surface in the admin UI
//
// Use this from every edge function that notifies the internal sales/ops team.
// DO NOT use it for customer-facing mail — customers should keep receiving
// mail from info@buyawarranty.co.uk for brand consistency.

import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from "./log-email.ts";

// Dedicated internal-notifications sender. Requires SPF/DKIM/DMARC set up
// for notify.buyawarranty.co.uk in Resend + DNS. Overridable via env if the
// user later chooses a different subdomain (e.g. alerts.buyawarranty.co.uk).
export const INTERNAL_NOTIFICATION_FROM =
  Deno.env.get("INTERNAL_NOTIFICATION_FROM") ||
  "Buyawarranty Alerts <notifications@notify.buyawarranty.co.uk>";

export interface InternalNotificationInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Short identifier of the notification kind, used in logs + Resend tags. */
  template: string;
  /** Which edge function is sending. */
  sourceFunction: string;
  /** Optional context passed through to email_logs metadata. */
  metadata?: Record<string, unknown>;
  /** Number of send attempts (default 4 → ~1s, 2s, 4s backoff between). */
  maxAttempts?: number;
}

export interface InternalNotificationResult {
  ok: boolean;
  messageId?: string | null;
  attempts: number;
  error?: string;
  perRecipient: Array<{
    email: string;
    ok: boolean;
    messageId?: string | null;
    attempts: number;
    error?: string;
  }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isValidEmail = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Send an internal notification email. Sends one message per recipient so each
 * gets its own DKIM signature (better deliverability, no CC/BCC that some
 * receivers treat as bulk). Retries on transient errors, logs every attempt.
 */
export async function sendInternalNotification(
  input: InternalNotificationInput,
): Promise<InternalNotificationResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    const msg = "RESEND_API_KEY not configured";
    console.error(`[${input.sourceFunction}] ${msg}`);
    return { ok: false, attempts: 0, error: msg, perRecipient: [] };
  }
  const resend = new Resend(apiKey);
  const maxAttempts = Math.max(1, input.maxAttempts ?? 4);
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => (e || "").trim())
    .filter(isValidEmail);

  if (recipients.length === 0) {
    const msg = "No valid recipients";
    console.error(`[${input.sourceFunction}] ${msg}`);
    return { ok: false, attempts: 0, error: msg, perRecipient: [] };
  }

  const perRecipient: InternalNotificationResult["perRecipient"] = [];

  for (const recipient of recipients) {
    let attempts = 0;
    let lastError: string | undefined;
    let messageId: string | null | undefined;
    let ok = false;

    while (attempts < maxAttempts && !ok) {
      attempts++;
      try {
        const resp = await resend.emails.send({
          from: INTERNAL_NOTIFICATION_FROM,
          to: [recipient],
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
          headers: {
            // Transactional signal — do NOT let receivers treat as bulk.
            "X-Entity-Ref-ID": `${input.template}-${Date.now()}`,
            "X-BAW-Notification": input.template,
          },
          tags: [
            { name: "template", value: input.template.slice(0, 40) },
            { name: "kind", value: "internal_notification" },
            { name: "source", value: input.sourceFunction.slice(0, 40) },
          ],
        });

        if (resp.error) {
          lastError = resp.error.message || String(resp.error);
          console.error(
            `[${input.sourceFunction}] attempt ${attempts}/${maxAttempts} rejected by Resend for ${recipient}:`,
            resp.error,
          );
        } else {
          messageId = resp.data?.id ?? null;
          ok = true;
          console.log(
            `[${input.sourceFunction}] sent internal notification to ${recipient} on attempt ${attempts} (message_id=${messageId})`,
          );
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(
          `[${input.sourceFunction}] attempt ${attempts}/${maxAttempts} threw for ${recipient}:`,
          err,
        );
      }

      if (!ok && attempts < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s...
        await sleep(1000 * Math.pow(2, attempts - 1));
      }
    }

    // Log every recipient send (success or final failure).
    await logCustomerEmail({
      recipient_email: recipient,
      subject: input.subject,
      template_name: input.template,
      source_function: input.sourceFunction,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : lastError ?? "unknown failure",
      metadata: {
        ...(input.metadata ?? {}),
        internal_notification: true,
        sender: INTERNAL_NOTIFICATION_FROM,
        provider_message_id: messageId ?? null,
        attempts,
        max_attempts: maxAttempts,
      },
    });

    perRecipient.push({ email: recipient, ok, messageId, attempts, error: ok ? undefined : lastError });
  }

  const allOk = perRecipient.every((r) => r.ok);
  const firstOk = perRecipient.find((r) => r.ok);
  return {
    ok: allOk,
    messageId: firstOk?.messageId ?? null,
    attempts: perRecipient.reduce((n, r) => Math.max(n, r.attempts), 0),
    error: allOk ? undefined : perRecipient.find((r) => !r.ok)?.error,
    perRecipient,
  };
}
