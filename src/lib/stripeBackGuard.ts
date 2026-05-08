/**
 * Stripe Checkout back-navigation guard.
 *
 * Stripe Checkout is hosted on checkout.stripe.com, so the browser back button
 * from there normally takes the user to whatever page came BEFORE our checkout
 * (often Google). To keep them inside our funnel, we push a sentinel history
 * entry on our own origin right before redirecting to Stripe. When the user
 * presses back on Stripe, the browser pops back to our site (the sentinel
 * entry), at which point we ask: "Cancel payment? Yes / No".
 *
 *  - Yes → stay on the checkout page (user safely cancels).
 *  - No  → resume by re-redirecting to the saved Stripe URL.
 */

const STORAGE_KEY = 'baw_stripe_back_guard';

interface GuardPayload {
  url: string;
  returnPath: string;
  ts: number;
}

/**
 * Call this immediately before `window.location.href = stripeUrl`.
 * Pushes a sentinel history entry so back from Stripe lands on our site.
 */
export const redirectToStripeWithBackGuard = (stripeUrl: string) => {
  // Back-guard popup removed — users can simply use the browser/page back
  // button to return to checkout. We just redirect to Stripe directly.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
  window.location.href = stripeUrl;
};

export const readStripeBackGuard = (): GuardPayload | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuardPayload;
    // Expire after 30 minutes
    if (Date.now() - parsed.ts > 30 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearStripeBackGuard = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};
