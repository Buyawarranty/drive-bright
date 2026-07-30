/**
 * Microsoft Advertising (Bing) Click ID capture utility.
 * Captures and stores msclkid so Bing Ads traffic can be attributed through the funnel.
 *
 * Mirrors gclidCapture / fbclidCapture:
 *  - localStorage copy (long-lived, for conversion uploads once Bing is connected)
 *  - sessionStorage copy (session-scoped, used for lead-source attribution)
 */

const MSCLKID_STORAGE_KEY = 'baw_msclkid';
const MSCLKID_EXPIRY_DAYS = 90;

interface StoredMsclkid {
  msclkid: string;
  capturedAt: number;
  landingPage: string;
}

/**
 * Capture msclkid from the URL on page load.
 */
export const captureMsclkid = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const msclkid = urlParams.get('msclkid');
    if (!msclkid) return;

    const data: StoredMsclkid = {
      msclkid,
      capturedAt: Date.now(),
      landingPage: window.location.pathname,
    };
    const serialized = JSON.stringify(data);
    try { localStorage.setItem(MSCLKID_STORAGE_KEY, serialized); } catch {}
    try { sessionStorage.setItem(MSCLKID_STORAGE_KEY, serialized); } catch {}
    console.log('🔎 MSCLKID captured and stored:', msclkid);
  } catch (error) {
    console.error('Failed to capture MSCLKID:', error);
  }
};

/**
 * Long-lived msclkid (within expiry window). For conversion uploads.
 */
export const getStoredMsclkid = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(MSCLKID_STORAGE_KEY);
    if (!stored) return null;

    const data: StoredMsclkid = JSON.parse(stored);
    const expiryMs = MSCLKID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - data.capturedAt > expiryMs) {
      localStorage.removeItem(MSCLKID_STORAGE_KEY);
      return null;
    }
    return data.msclkid || null;
  } catch (error) {
    console.error('Failed to get stored MSCLKID:', error);
    return null;
  }
};

/**
 * Session-scoped msclkid: only set if this visit came from a Bing ad.
 * Use this for lead-source attribution.
 */
export const getSessionMsclkid = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(MSCLKID_STORAGE_KEY);
    if (!stored) return null;
    const data: StoredMsclkid = JSON.parse(stored);
    return data.msclkid || null;
  } catch {
    return null;
  }
};

export const isBingAdsVisitor = (): boolean => !!getSessionMsclkid();

export const clearStoredMsclkid = (): void => {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(MSCLKID_STORAGE_KEY); } catch {}
};
