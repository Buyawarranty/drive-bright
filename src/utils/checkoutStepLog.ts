import { supabase } from "@/integrations/supabase/client";
import { getTrackingSessionId } from "@/utils/gclidCapture";

/**
 * Records a Step 4 checkout moment (viewed, pay clicked, details missing,
 * handed to Bumper, etc.) for the admin Direct sales analysis.
 * Fire-and-forget: never blocks or slows checkout.
 */
export type CheckoutStepEvent =
  | "step4_viewed"
  | "pay_clicked"
  | "details_incomplete"
  | "declaration_missing"
  | "duplicate_blocked"
  | "bumper_handoff"
  | "bumper_error"
  | "stripe_form_shown"
  | "stripe_error";

export const logCheckoutStep = (
  event: CheckoutStepEvent,
  extra?: { paymentMethod?: "stripe" | "bumper"; amount?: number; details?: Record<string, unknown> },
): void => {
  try {
    void (supabase.from as any)("checkout_step_events")
      .insert({
        event,
        session_id: getTrackingSessionId(),
        payment_method: extra?.paymentMethod ?? null,
        amount: typeof extra?.amount === "number" ? extra.amount : null,
        details: extra?.details ?? null,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("checkout_step_events insert failed:", error.message);
      });
  } catch {
    /* never block checkout */
  }
};
