import { supabase } from "@/integrations/supabase/client";
import { getTrackingData, getTrackingSessionId } from "@/utils/gclidCapture";

/**
 * Logs a payment-button click on step 4 (Stripe or Bumper) to
 * public.payment_button_clicks so both buttons can be counted
 * like-for-like in reporting. Fire-and-forget: never blocks checkout.
 */
export const logPaymentButtonClick = (params: {
  paymentMethod: "stripe" | "bumper";
  amount?: number;
  email?: string;
  vehicleReg?: string;
}): void => {
  try {
    const tracking = getTrackingData();
    void supabase
      .from("payment_button_clicks")
      .insert({
        payment_method: params.paymentMethod,
        amount: typeof params.amount === "number" ? params.amount : null,
        email: params.email || null,
        vehicle_reg: params.vehicleReg || null,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
        gclid: tracking.gclid,
        fbclid: tracking.fbclid,
        tracking_session_id: getTrackingSessionId(),
      })
      .then(({ error }) => {
        if (error) console.warn("payment_button_clicks insert failed:", error.message);
      });
  } catch (err) {
    console.warn("payment_button_clicks logging skipped:", err);
  }
};
