/**
 * Facebook Click ID (FBCLID) Capture Utility
 * Captures and stores FBCLID for tracking Facebook ad conversions through the funnel
 */

const FBCLID_STORAGE_KEY = 'baw_fbclid';
const FBCLID_EXPIRY_DAYS = 90;

interface StoredFbclid {
  fbclid: string;
  capturedAt: number;
  landingPage: string;
}

/**
 * Capture FBCLID from URL parameters on page load
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

      localStorage.setItem(FBCLID_STORAGE_KEY, JSON.stringify(fbclidData));
      console.log('📘 FBCLID captured and stored:', fbclid);
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
 * Check if the current session originated from a Facebook ad
 */
export const isFacebookAdsVisitor = (): boolean => {
  return !!getStoredFbclid();
};

/**
 * Clear stored FBCLID (call after successful conversion)
 */
export const clearStoredFbclid = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FBCLID_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear FBCLID:', error);
  }
};
