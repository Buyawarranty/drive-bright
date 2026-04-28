/**
 * Facebook Click ID (FBCLID) Capture Utility
 * Captures and stores FBCLID for tracking Facebook ad conversions through the funnel.
 * Also detects Facebook/Instagram referrer as a fallback when fbclid is stripped.
 */

const FBCLID_STORAGE_KEY = 'baw_fbclid';
const FB_REFERRER_KEY = 'baw_fb_referrer';
const FBCLID_EXPIRY_DAYS = 90;

interface StoredFbclid {
  fbclid: string;
  capturedAt: number;
  landingPage: string;
}

interface StoredFbReferrer {
  referrer: string;
  capturedAt: number;
  landingPage: string;
}

const FACEBOOK_REFERRER_PATTERNS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'l.facebook.com',
  'lm.facebook.com',
  'm.facebook.com',
  'l.instagram.com',
];

/**
 * Capture FBCLID from URL parameters on page load.
 * Also captures Facebook/Instagram referrer as fallback attribution.
 */
export const captureFbclid = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');

    if (fbclid) {
      const fbclidData: StoredFbclid = {
        fbclid,
        capturedAt: Date.now(),
        landingPage: window.location.pathname,
      };

      const serialized = JSON.stringify(fbclidData);
      try { localStorage.setItem(FBCLID_STORAGE_KEY, serialized); } catch {}
      try { sessionStorage.setItem(FBCLID_STORAGE_KEY, serialized); } catch {}
      console.log('📘 FBCLID captured and stored:', fbclid);
    }

    // Fallback: capture Facebook/Instagram referrer even when fbclid is missing
    // (common with iOS ITP, in-app browser → external browser handoff, etc.)
    if (!fbclid && !getStoredFbclid()) {
      const referrer = document.referrer || '';
      const isFbReferrer = FACEBOOK_REFERRER_PATTERNS.some(pattern =>
        referrer.toLowerCase().includes(pattern)
      );
      if (isFbReferrer) {
        const refData: StoredFbReferrer = {
          referrer,
          capturedAt: Date.now(),
          landingPage: window.location.pathname,
        };
        const serialized = JSON.stringify(refData);
        try { localStorage.setItem(FB_REFERRER_KEY, serialized); } catch {}
        try { sessionStorage.setItem(FB_REFERRER_KEY, serialized); } catch {}
        console.log('📘 Facebook referrer detected (no fbclid):', referrer);
      }
    }
  } catch (error) {
    console.error('Failed to capture FBCLID:', error);
  }
};

/**
 * Get stored FBCLID if still valid (within expiry period)
 */
export const getStoredFbclid = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(FBCLID_STORAGE_KEY);
    if (!stored) return null;

    const fbclidData: StoredFbclid = JSON.parse(stored);
    const expiryMs = FBCLID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (Date.now() - fbclidData.capturedAt > expiryMs) {
      localStorage.removeItem(FBCLID_STORAGE_KEY);
      return null;
    }

    return fbclidData.fbclid;
  } catch (error) {
    console.error('Failed to get stored FBCLID:', error);
    return null;
  }
};

/**
 * Check if we detected a Facebook/Instagram referrer (fallback when fbclid missing)
 */
export const getStoredFbReferrer = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(FB_REFERRER_KEY);
    if (!stored) return null;

    const refData: StoredFbReferrer = JSON.parse(stored);
    const expiryMs = FBCLID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (Date.now() - refData.capturedAt > expiryMs) {
      localStorage.removeItem(FB_REFERRER_KEY);
      return null;
    }

    return refData.referrer;
  } catch (error) {
    console.error('Failed to get stored FB referrer:', error);
    return null;
  }
};

/**
 * Check if the current session originated from a Facebook ad
 * (either via fbclid or referrer detection)
 */
export const isFacebookAdsVisitor = (): boolean => {
  return !!getStoredFbclid() || !!getStoredFbReferrer();
};

/**
 * Clear stored FBCLID and referrer (call after successful conversion)
 */
export const clearStoredFbclid = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FBCLID_STORAGE_KEY);
    localStorage.removeItem(FB_REFERRER_KEY);
  } catch (error) {
    console.error('Failed to clear FBCLID:', error);
  }
};

/**
 * Session-scoped FBCLID: returns the fbclid ONLY if captured during the
 * CURRENT browser session. Used for lead-source attribution so that
 * long-lived localStorage values (up to 90 days old) don't reclassify
 * organic visitors as Facebook Ads traffic.
 */
export const getSessionFbclid = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(FBCLID_STORAGE_KEY);
    if (!stored) return null;
    const data: StoredFbclid = JSON.parse(stored);
    return data.fbclid || null;
  } catch {
    return null;
  }
};

/**
 * Session-scoped Facebook referrer: only returns a value if detected this session.
 */
export const getSessionFbReferrer = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(FB_REFERRER_KEY);
    if (!stored) return null;
    const data: StoredFbReferrer = JSON.parse(stored);
    return data.referrer || null;
  } catch {
    return null;
  }
};
