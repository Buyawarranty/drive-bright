/**
 * TikTok Ads Click ID capture utility.
 * Captures and stores ttclid so TikTok Ads traffic can be attributed through the funnel.
 *
 * Mirrors gclidCapture / fbclidCapture / msclkidCapture:
 *  - localStorage copy (long-lived, for conversion uploads)
 *  - sessionStorage copy (session-scoped, used for lead-source attribution)
 */

const TTCLID_STORAGE_KEY = 'baw_ttclid';
const TTCLID_EXPIRY_DAYS = 90;

interface StoredTtclid {
  ttclid: string;
  capturedAt: number;
  landingPage: string;
}

/** Capture ttclid from the URL on page load. */
export const captureTtclid = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const ttclid = urlParams.get('ttclid');
    if (!ttclid) return;

    const data: StoredTtclid = {
      ttclid,
      capturedAt: Date.now(),
      landingPage: window.location.pathname,
    };
    const serialized = JSON.stringify(data);
    try { localStorage.setItem(TTCLID_STORAGE_KEY, serialized); } catch {}
    try { sessionStorage.setItem(TTCLID_STORAGE_KEY, serialized); } catch {}
    console.log('🎵 TTCLID captured and stored:', ttclid);
  } catch (error) {
    console.error('Failed to capture TTCLID:', error);
  }
};

/** Long-lived ttclid (within expiry window). For conversion uploads. */
export const getStoredTtclid = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(TTCLID_STORAGE_KEY);
    if (!stored) return null;

    const data: StoredTtclid = JSON.parse(stored);
    const expiryMs = TTCLID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - data.capturedAt > expiryMs) {
      localStorage.removeItem(TTCLID_STORAGE_KEY);
      return null;
    }
    return data.ttclid || null;
  } catch (error) {
    console.error('Failed to get stored TTCLID:', error);
    return null;
  }
};

/**
 * Session-scoped ttclid: only set if this visit came from a TikTok ad.
 * Use this for lead-source attribution.
 */
export const getSessionTtclid = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(TTCLID_STORAGE_KEY);
    if (!stored) return null;
    const data: StoredTtclid = JSON.parse(stored);
    return data.ttclid || null;
  } catch {
    return null;
  }
};

export const isTikTokAdsVisitor = (): boolean => !!getSessionTtclid();

export const clearStoredTtclid = (): void => {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(TTCLID_STORAGE_KEY); } catch {}
};
