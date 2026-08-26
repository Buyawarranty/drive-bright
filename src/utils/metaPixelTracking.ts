/**
 * Meta Pixel funnel event tracking
 * Fires fbq events at key steps: homepage view, Step 2 lead, Step 3 pricing, checkout
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

const CURRENCY = 'GBP';

/** Coerce to a valid positive number, else undefined */
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v);
  return Number.isFinite(n) && (n as number) >= 0 ? Math.round((n as number) * 100) / 100 : undefined;
};

/**
 * Meta rejects events where `value` is present without a valid `currency`,
 * or where value/currency are empty/undefined. This normalises both:
 * - drops null/undefined/empty params
 * - only sends `value` when it is a real number, always paired with GBP
 */
const sanitize = (params?: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (k === 'value' || k === 'currency') continue;
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  const value = num(params?.value);
  if (value !== undefined) {
    out.value = value;
    out.currency = CURRENCY;
  }
  return out;
};

/**
 * Fire Meta Pixel event for funnel tracking
 */
export const trackMetaPixelFunnelEvent = (
  eventName: string,
  params?: Record<string, any>
) => {
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
 * Homepage view - fires ViewContent
 */
export const trackFBHomepageView = () => {
  trackMetaPixelFunnelEvent('ViewContent', {
    content_name: 'Homepage',
    content_category: 'Landing Page',
  });
};

/**
 * Step 2 completion - fires Lead event
 * This is when the user submits their vehicle + contact details
 */
export const trackFBLeadCapture = (vehicleReg?: string, email?: string) => {
  trackMetaPixelFunnelEvent('Lead', {
    content_name: 'Step 2 - Vehicle Details',
    content_category: 'Lead Capture',
    vehicle_reg: vehicleReg,
  });
};

/**
 * Step 3 pricing view - fires AddToCart
 */
export const trackFBPricingView = (planName?: string, value?: number) => {
  trackMetaPixelFunnelEvent('AddToCart', {
    content_name: planName || 'Warranty Plan',
    content_category: 'Pricing',
    value,
  });
};

/**
 * Step 4 checkout - fires InitiateCheckout
 */
export const trackFBCheckout = (value?: number) => {
  trackMetaPixelFunnelEvent('InitiateCheckout', { value });
};

/**
 * Purchase complete - fires Purchase
 */
export const trackFBPurchase = (value: number, transactionId: string) => {
  trackMetaPixelFunnelEvent('Purchase', {
    value,
    transaction_id: transactionId,
  });
};
