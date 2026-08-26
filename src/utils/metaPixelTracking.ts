/**
 * Meta Pixel tracking — LEAD GENERATION ONLY.
 *
 * We deliberately do NOT track sales/purchase, pricing views or checkout.
 * The only event fired is `Lead`, on Step 2 of the website (quote delivery
 * form submission). Do not add Purchase/AddToCart/InitiateCheckout here.
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

/** Only the lead event is allowed */
const ALLOWED_EVENTS = ['Lead'];

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
