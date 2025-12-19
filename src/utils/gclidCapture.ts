/**
 * Google Click ID (GCLID) Capture Utility
 * Captures and stores GCLID for offline/server-side conversion tracking
 */

const GCLID_STORAGE_KEY = 'baw_gclid';
const CLIENT_ID_STORAGE_KEY = 'baw_ga_client_id';
const GCLID_EXPIRY_DAYS = 90;

interface StoredGclid {
  gclid: string;
  capturedAt: number;
  landingPage: string;
}

/**
 * Capture GCLID from URL parameters on page load
 * Should be called on every page to ensure GCLID is captured
 */
export const captureGclid = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const gclid = urlParams.get('gclid');
    
    if (gclid) {
      const gclidData: StoredGclid = {
        gclid,
        capturedAt: Date.now(),
        landingPage: window.location.pathname,
      };
      
      localStorage.setItem(GCLID_STORAGE_KEY, JSON.stringify(gclidData));
      console.log('🎯 GCLID captured and stored:', gclid);
    }
  } catch (error) {
    console.error('Failed to capture GCLID:', error);
  }
};

/**
 * Get stored GCLID if still valid (within expiry period)
 */
export const getStoredGclid = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(GCLID_STORAGE_KEY);
    if (!stored) return null;
    
    const gclidData: StoredGclid = JSON.parse(stored);
    const expiryMs = GCLID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (Date.now() - gclidData.capturedAt > expiryMs) {
      // GCLID expired, remove it
      localStorage.removeItem(GCLID_STORAGE_KEY);
      console.log('🎯 GCLID expired and removed');
      return null;
    }
    
    return gclidData.gclid;
  } catch (error) {
    console.error('Failed to get stored GCLID:', error);
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
    // Try to get from _ga cookie
    const gaCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('_ga='));
    
    if (gaCookie) {
      const gaValue = gaCookie.split('=')[1];
      // Extract client ID (last two parts)
      const parts = gaValue.split('.');
      if (parts.length >= 4) {
        const clientId = `${parts[2]}.${parts[3]}`;
        return clientId;
      }
    }
    
    // Try stored client ID
    const storedClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (storedClientId) return storedClientId;
    
    // Generate a new client ID if none exists
    const newClientId = `${Math.floor(Math.random() * 2147483647)}.${Math.floor(Date.now() / 1000)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, newClientId);
    
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
    console.log('🎯 GCLID cleared after conversion');
  } catch (error) {
    console.error('Failed to clear GCLID:', error);
  }
};
