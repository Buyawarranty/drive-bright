/**
 * Google Click ID (GCLID) Capture Utility
 * Captures and stores GCLID for offline/server-side conversion tracking
 *
 * Robustness:
 *  - Reads gclid / gbraid / wbraid from URL (Google Ads auto-tagging variants)
 *  - Reads the `_gcl_aw` cookie set by gtag.js (most reliable, persists 90d)
 *  - Mirrors to BOTH localStorage and sessionStorage so private/Safari/ITP
 *    sessions and cross-domain redirects (e.g. Bumper) don't lose the value
 */

const GCLID_STORAGE_KEY = 'baw_gclid';
const CLIENT_ID_STORAGE_KEY = 'baw_ga_client_id';
const GCLID_EXPIRY_DAYS = 90;

interface StoredGclid {
  gclid: string;
  capturedAt: number;
  landingPage: string;
}

const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
};

const safeGet = (key: string): string | null => {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
  } catch {}
  try {
    return sessionStorage.getItem(key);
  } catch {}
  return null;
};

/**
 * Read gclid from the _gcl_aw cookie set by gtag.js.
 * Format: GCL.<timestamp>.<gclid>
 */
const readGclidFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('_gcl_aw='));
    if (!cookie) return null;
    const value = cookie.split('=')[1];
    const parts = value.split('.');
    // last segment is the gclid
    if (parts.length >= 3) return parts.slice(2).join('.');
    return null;
  } catch {
    return null;
  }
};

/**
 * Capture GCLID from URL parameters (and gbraid/wbraid fallbacks).
 * Should be called on every page to ensure GCLID is captured.
 */
export const captureGclid = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    // Order of preference: gclid > gbraid > wbraid
    const gclid =
      urlParams.get('gclid') ||
      urlParams.get('gbraid') ||
      urlParams.get('wbraid');

    if (gclid) {
      const gclidData: StoredGclid = {
        gclid,
        capturedAt: Date.now(),
        landingPage: window.location.pathname,
      };
      safeSet(GCLID_STORAGE_KEY, JSON.stringify(gclidData));
      console.log('🎯 GCLID/GBRAID captured and stored:', gclid);
      return;
    }

    // No URL param — try the cookie set by gtag.js (only if we don't already have one stored)
    if (!safeGet(GCLID_STORAGE_KEY)) {
      const cookieGclid = readGclidFromCookie();
      if (cookieGclid) {
        const gclidData: StoredGclid = {
          gclid: cookieGclid,
          capturedAt: Date.now(),
          landingPage: window.location.pathname,
        };
        safeSet(GCLID_STORAGE_KEY, JSON.stringify(gclidData));
        console.log('🎯 GCLID recovered from _gcl_aw cookie:', cookieGclid);
      }
    }
  } catch (error) {
    console.error('Failed to capture GCLID:', error);
  }
};

/**
 * Get stored GCLID if still valid (within expiry period).
 * Falls back to the _gcl_aw cookie if storage was wiped.
 */
export const getStoredGclid = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = safeGet(GCLID_STORAGE_KEY);
    if (stored) {
      const gclidData: StoredGclid = JSON.parse(stored);
      const expiryMs = GCLID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (Date.now() - gclidData.capturedAt > expiryMs) {
        try { localStorage.removeItem(GCLID_STORAGE_KEY); } catch {}
        try { sessionStorage.removeItem(GCLID_STORAGE_KEY); } catch {}
        console.log('🎯 GCLID expired and removed');
      } else {
        return gclidData.gclid;
      }
    }

    // Last-resort fallback: read directly from gtag's _gcl_aw cookie
    const cookieGclid = readGclidFromCookie();
    if (cookieGclid) {
      // Persist for next time
      const gclidData: StoredGclid = {
        gclid: cookieGclid,
        capturedAt: Date.now(),
        landingPage: window.location.pathname,
      };
      safeSet(GCLID_STORAGE_KEY, JSON.stringify(gclidData));
      return cookieGclid;
    }

    return null;
  } catch (error) {
    console.error('Failed to get stored GCLID:', error);
    return null;
  }
};

/**
 * Session-scoped GCLID: returns the gclid ONLY if it was captured during the
 * CURRENT browser session (sessionStorage). Used for lead-source attribution
 * so that long-lived localStorage values (up to 90 days old) don't reclassify
 * organic visitors as Google Ads traffic.
 *
 * IMPORTANT: Use `getStoredGclid()` for Google Ads conversion uploads (which
 * legitimately need the 90-day window). Use this function for lead source.
 */
export const getSessionGclid = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(GCLID_STORAGE_KEY);
    if (!stored) return null;
    const gclidData: StoredGclid = JSON.parse(stored);
    return gclidData.gclid || null;
  } catch {
    return null;
  }
};

/**
 * Get GA4 Client ID from cookies
 * Format: GA1.1.XXXXXXXXXX.XXXXXXXXXX
 */
export const getGaClientId = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const gaCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('_ga='));

    if (gaCookie) {
      const gaValue = gaCookie.split('=')[1];
      const parts = gaValue.split('.');
      if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`;
      }
    }

    const storedClientId = safeGet(CLIENT_ID_STORAGE_KEY);
    if (storedClientId) return storedClientId;

    const newClientId = `${Math.floor(Math.random() * 2147483647)}.${Math.floor(Date.now() / 1000)}`;
    safeSet(CLIENT_ID_STORAGE_KEY, newClientId);
    return newClientId;
  } catch (error) {
    console.error('Failed to get GA Client ID:', error);
    return null;
  }
};

/**
 * Get all tracking data for checkout
 */
export const getTrackingData = (): { gclid: string | null; clientId: string | null } => {
  return {
    gclid: getStoredGclid(),
    clientId: getGaClientId(),
  };
};

/**
 * Clear stored GCLID (call after successful conversion)
 */
export const clearStoredGclid = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GCLID_STORAGE_KEY);
    sessionStorage.removeItem(GCLID_STORAGE_KEY);
    console.log('🎯 GCLID cleared after conversion');
  } catch (error) {
    console.error('Failed to clear GCLID:', error);
  }
};
