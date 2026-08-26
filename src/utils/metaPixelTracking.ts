/**
 * Meta Pixel tracking — two separate events only:
 *  - `Lead`     → Step 2 of the website (quote delivery form submission)
 *  - `Purchase` → completed sale on the thank-you page (sales tracking)
 *
 * No pricing-view / AddToCart / InitiateCheckout funnel tracking.
 * `Lead` never carries value or currency; `Purchase` always sends a numeric
 * value with a valid GBP currency code (Meta data-quality requirement).
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

/** Only these two events are allowed */
const ALLOWED_EVENTS = ['Lead', 'Purchase'];

/**
 * Strip empty params, and never send monetary value/currency —
 * we are not tracking revenue in Meta.
 */
const sanitize = (params?: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (k === 'value' || k === 'currency') continue;
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
};

/**
 * Fire a Meta Pixel lead event. Any non-lead event is ignored by design.
 */
export const trackMetaPixelFunnelEvent = (
  eventName: string,
  params?: Record<string, any>
) => {
  if (!ALLOWED_EVENTS.includes(eventName)) {
    return; // sales / pricing / checkout tracking intentionally disabled
  }
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      const clean = sanitize(params);
      window.fbq('track', eventName, clean);
      console.log(`📘 Meta Pixel: ${eventName}`, clean);
    } catch (error) {
      console.error(`Meta Pixel tracking failed for ${eventName}:`, error);
    }
  }
};

/**
 * Step 2 completion - fires the Lead event
 * This is when the user submits their vehicle + contact details
 */
export const trackFBLeadCapture = (vehicleReg?: string) => {
  trackMetaPixelFunnelEvent('Lead', {
    content_name: 'Step 2 - Vehicle Details',
    content_category: 'Lead Capture',
    vehicle_reg: vehicleReg,
  });
};

/**
 * Completed sale — fires the Purchase event with a real numeric value and GBP.
 * Kept entirely separate from the Step 2 Lead event.
 */
export const trackFBPurchase = (
  value: number,
  transactionId?: string,
  planName?: string
) => {
  if (typeof window === 'undefined' || !window.fbq) return;
  const numericValue = typeof value === 'number' && isFinite(value) && value > 0 ? value : undefined;
  if (numericValue === undefined) return; // never send a blank/zero value to Meta

  const payload: Record<string, any> = {
    value: numericValue,
    currency: 'GBP',
  };
  if (transactionId) payload.order_id = transactionId;
  if (planName) {
    payload.content_name = planName;
    payload.content_type = 'product';
  }

  try {
    window.fbq('track', 'Purchase', payload);
    console.log('📘 Meta Pixel: Purchase', payload);
  } catch (error) {
    console.error('Meta Pixel Purchase tracking failed:', error);
  }
};
