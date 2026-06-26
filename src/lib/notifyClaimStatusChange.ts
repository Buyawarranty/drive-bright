import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget notification to the customer that their claim status changed.
 * Safe to call after any claims_submissions status update — the edge function
 * will skip statuses that don't have customer-facing copy.
 */
export async function notifyClaimStatusChange(claimId: string, status: string) {
  if (!claimId || !status) return;
  try {
    await supabase.functions.invoke("send-claim-status-email", {
      body: { claimId, status },
    });
  } catch (e) {
    console.warn("[notifyClaimStatusChange] failed", e);
  }
}
