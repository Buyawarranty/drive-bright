/**
 * Meta Pixel funnel event tracking
 * Fires fbq events at key steps: homepage view, Step 2 lead, Step 3 pricing, checkout
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

/**
 * Fire Meta Pixel event for funnel tracking
 */
export const trackMetaPixelFunnelEvent = (
  eventName: string,
  params?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', eventName, params);
      console.log(`📘 Meta Pixel: ${eventName}`, params);
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
    value: value,
    currency: 'GBP',
  });
};

/**
 * Step 4 checkout - fires InitiateCheckout
 */
export const trackFBCheckout = (value?: number) => {
  trackMetaPixelFunnelEvent('InitiateCheckout', {
    value: value,
    currency: 'GBP',
  });
};

/**
 * Purchase complete - fires Purchase
 */
export const trackFBPurchase = (value: number, transactionId: string) => {
  trackMetaPixelFunnelEvent('Purchase', {
    value: value,
    currency: 'GBP',
    transaction_id: transactionId,
  });
};
