// Google Analytics & Google Ads tracking utilities

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

export const trackFormSubmission = (formName: string, additionalData?: Record<string, any>) => {
  trackEvent('form_submit', {
    form_name: formName,
    ...additionalData
  });
};

export const trackButtonClick = (buttonName: string, additionalData?: Record<string, any>) => {
  trackEvent('button_click', {
    button_name: buttonName,
    ...additionalData
  });
};

export const trackPageView = (pageName: string) => {
  trackEvent('page_view', {
    page_name: pageName
  });
};

export const trackConversion = (conversionType: string, value?: number) => {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value: value
  });
};

// Google Ads Conversion Tracking Functions
export const trackGoogleAdsConversion = (
  conversionLabel: string, 
  value?: number, 
  transactionId?: string,
  enhancedData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
  }
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    const conversionData: any = {
      'send_to': `AW-17325228149/${conversionLabel}`,
    };

    if (value !== undefined) {
      conversionData.value = value;
      conversionData.currency = 'GBP';
    }

    if (transactionId) {
      conversionData.transaction_id = transactionId;
    }

    // Enhanced Conversions - add user data if available
    if (enhancedData) {
      const userData: any = {};
      
      if (enhancedData.email) {
        userData.email = enhancedData.email;
      }
      if (enhancedData.phone) {
        userData.phone_number = enhancedData.phone;
      }
      if (enhancedData.firstName) {
        userData.first_name = enhancedData.firstName;
      }
      if (enhancedData.lastName) {
        userData.last_name = enhancedData.lastName;
      }
      if (enhancedData.address) {
        userData.address = {
          street: enhancedData.address
        };
      }

      if (Object.keys(userData).length > 0) {
        conversionData.user_data = userData;
      }
    }

    // ✅ VALIDATION: Check if we have required data for Enhanced Conversions
    const hasEmail = enhancedData?.email;
    const hasPhone = enhancedData?.phone;
    
    if (!hasEmail && !hasPhone) {
      console.warn('⚠️ Google Ads Enhanced Conversion: Missing required data! Need at least email OR phone number.');
      console.warn('Current data:', { enhancedData });
    } else {
      console.log('✅ Google Ads Enhanced Conversion data is valid:', {
        hasEmail,
        hasPhone,
        hasName: !!(enhancedData?.firstName && enhancedData?.lastName),
        hasAddress: !!enhancedData?.address
      });
    }

    // 📊 DETAILED LOGGING for debugging
    console.log('🎯 Google Ads Conversion Event:', {
      label: conversionLabel,
      value: value,
      currency: 'GBP',
      transactionId: transactionId,
      userData: conversionData.user_data || 'No user data',
      fullPayload: conversionData
    });

    window.gtag('event', 'conversion', conversionData);
  } else {
    console.error('❌ Google Ads tracking failed: gtag not available');
  }
};

// Specific conversion tracking functions for different actions
export const trackQuoteRequest = (email?: string, phone?: string, value?: number) => {
  trackGoogleAdsConversion('quote_request', value, undefined, { email, phone });
  trackEvent('generate_lead', {
    value: value,
    currency: 'GBP'
  });
};

export const trackStepCompletion = (stepNumber: number, stepName: string, userData?: any) => {
  trackEvent('checkout_progress', {
    step: stepNumber,
    step_name: stepName
  });
  
  // Track as conversion in Google Ads
  if (stepNumber === 1) {
    trackGoogleAdsConversion('step_1_complete', undefined, undefined, userData);
  } else if (stepNumber === 2) {
    trackGoogleAdsConversion('step_2_complete', undefined, undefined, userData);
  } else if (stepNumber === 3) {
    trackGoogleAdsConversion('step_3_complete', undefined, undefined, userData);
  }
};

export const trackBeginCheckout = (value: number, items?: any[], userData?: any) => {
  trackGoogleAdsConversion('begin_checkout', value, undefined, userData);
  trackEvent('begin_checkout', {
    value: value,
    currency: 'GBP',
    items: items
  });
};

export const trackPurchaseComplete = (
  value: number, 
  transactionId: string,
  enhancedData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
  }
) => {
  // NOTE: Enhanced conversion user_data should be set on the page BEFORE calling this
  // using gtag('set', 'user_data', {...}) - see ThankYou.tsx for implementation
  
  console.log('🛒 trackPurchaseComplete called:', { value, transactionId, enhancedData });
  
  // Initialize dataLayer if not present
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
  }
  
  // Push to dataLayer for GTM (Google Tag Manager) - Primary Conversion Event
  // CRITICAL: GTM tag expects 'order_value' at top level for {{DLV - order_value}} variable
  // Using fixed £1 value as configured in Google Ads (not actual purchase value)
  if (typeof window !== 'undefined' && window.dataLayer) {
    // CRITICAL: Grant consent before firing conversion to prevent GTM blocking
    // This updates consent mode for ad_storage, ad_personalization, ad_user_data
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      console.log('✅ Consent mode updated to granted for conversion tracking');
    }
    
    // Push the primary purchase conversion event for GTM
    window.dataLayer.push({
      'event': 'purchase',
      'order_value': 1, // Fixed £1 for Google Ads (as per business requirement)
      'transaction_id': transactionId,
      'currency': 'GBP',
      'ecommerce': {
        'transaction_id': transactionId,
        'value': value,
        'currency': 'GBP'
      },
      'user_data': enhancedData ? {
        email: enhancedData.email,
        phone_number: enhancedData.phone,
        address: {
          first_name: enhancedData.firstName,
          last_name: enhancedData.lastName,
          street: enhancedData.address
        }
      } : undefined
    });
    console.log('✅ GTM dataLayer "purchase" event pushed with order_value: 1');
    console.log('📊 DataLayer state:', window.dataLayer);
  }
  
  // Main purchase conversion with specific Google Ads conversion label (Purchase GTM Primary)
  // Label from Google Ads: AW-17325228149/U-BnCJKD2KUbEPWAqMVA
  // Fixed value of £1 per conversion as configured in Google Ads (not actual purchase value)
  trackGoogleAdsConversion('U-BnCJKD2KUbEPWAqMVA', 1, transactionId, enhancedData);
  
  // Track as GA4 purchase event
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: 'GBP'
  });
};

export const trackAddToCart = (value: number, itemName?: string) => {
  trackEvent('add_to_cart', {
    value: value,
    currency: 'GBP',
    items: itemName ? [{ item_name: itemName }] : []
  });
};

// Email marketing tracking
export const trackEmailOpen = (emailId: string, campaignName: string) => {
  trackEvent('email_open', {
    event_category: 'Email',
    event_label: campaignName,
    value: emailId,
  });
};

export const trackEmailClick = (emailId: string, campaignName: string, linkUrl: string) => {
  trackEvent('email_click', {
    event_category: 'Email',
    event_label: campaignName,
    value: linkUrl,
    email_id: emailId,
  });
};

// Track Bumper checkout button click (Complete checkout bumper conversion)
export const trackBumperCheckoutClick = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    console.log('🎯 Tracking Bumper checkout click conversion');
    window.gtag('event', 'conversion', {
      'send_to': 'AW-17325228149/WFAyCJiD2KUbEPWAqMVA'
    });
  }
};

// Track Stripe checkout button click (Begin checkout conversion)
export const trackStripeCheckoutClick = () => {
  if (typeof window !== 'undefined') {
    console.log('🎯 Tracking Stripe checkout click conversion');
    
    // Push to dataLayer for GTM triggers (Google Ads + GA4 begin_checkout)
    // Fixed £1 value per business rule
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'stripe_checkout_click',
      'conversion_value': 1,
      'currency': 'GBP',
      'payment_method': 'stripe'
    });
    
    // Also fire gtag directly as backup
    if (window.gtag) {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-17325228149',
        'value': 1,
        'currency': 'GBP'
      });
    }
  }
};

// Track Stripe checkout page load (Step 4 page view conversion)
export const trackStripeCheckoutPageLoad = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    console.log('🎯 Tracking Stripe checkout page load conversion');
    window.gtag('event', 'conversion', {
      'send_to': 'AW-17325228149'
    });
  }
};

// Track Step 4 email entry conversion (user enters email on checkout page)
export const trackStep4EmailEntry = (email?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    console.log('🎯 Tracking Step 4 email entry conversion');
    window.gtag('event', 'conversion', {
      'send_to': 'AW-17325228149',
      'event_category': 'Checkout',
      'event_label': 'Step 4 Email Entry'
    });
    
    // Also track as a custom event for analytics
    window.gtag('event', 'step4_email_entry', {
      'event_category': 'Checkout',
      'event_label': 'Email Entered',
      'user_email': email ? email.substring(0, 3) + '***' : undefined // Partial email for analytics
    });
  }
};

export const trackEmailConversion = (emailId: string, campaignName: string, value?: number) => {
  trackEvent('email_conversion', {
    event_category: 'Email',
    event_label: campaignName,
    value: value || 0,
    currency: 'GBP',
    email_id: emailId,
  });
  
  // Also track with Meta Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', {
      value: value || 0,
      currency: 'GBP',
      content_category: 'email_conversion',
      email_id: emailId,
      campaign_name: campaignName,
    });
  }
};