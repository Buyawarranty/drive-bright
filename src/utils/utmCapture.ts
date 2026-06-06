/**
 * UTM Parameter Capture Utility
 * Captures utm_source / utm_medium / utm_campaign / utm_term / utm_content from
 * the landing URL and persists them so they can be carried through the full
 * journey (quote → cart → checkout → customer record).
 *
 * SESSION-scoped mirror is used for lead-source / cart attribution so that
 * long-lived localStorage values can't reclassify organic visits as paid.
 * localStorage mirror exists only for long-window analytics fallbacks.
 */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
type UtmKey = typeof UTM_KEYS[number];

export type UtmParams = Partial<Record<UtmKey, string>>;

const STORAGE_KEY = 'baw_utm';
const EXPIRY_DAYS = 90;

interface StoredUtm {
  utms: UtmParams;
  capturedAt: number;
  landingPage: string;
}

const safeSet = (value: string) => {
  try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  try { sessionStorage.setItem(STORAGE_KEY, value); } catch {}
};

const readStored = (storage: Storage | null): StoredUtm | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUtm;
  } catch {
    return null;
  }
};

/**
 * Capture UTM params from the current URL. Call on every route change.
 * If the URL has at least one UTM, we overwrite any previous values.
 */
export const captureUtms = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utms: UtmParams = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) utms[k] = v;
    });
    if (Object.keys(utms).length === 0) return;

    const data: StoredUtm = {
      utms,
      capturedAt: Date.now(),
      landingPage: window.location.pathname,
    };
    safeSet(JSON.stringify(data));
    console.log('🔗 UTMs captured:', utms);
  } catch (e) {
    console.error('Failed to capture UTMs', e);
  }
};

/**
 * Session-scoped UTMs — use this for cart/lead attribution.
 */
export const getSessionUtms = (): UtmParams => {
  if (typeof window === 'undefined') return {};
  const data = readStored(typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  return data?.utms || {};
};

/**
 * Persistent UTMs (90-day) — use for analytics/conversion uploads only.
 */
export const getStoredUtms = (): UtmParams => {
  if (typeof window === 'undefined') return {};
  const data = readStored(typeof localStorage !== 'undefined' ? localStorage : null);
  if (!data) return {};
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - data.capturedAt > expiryMs) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return {};
  }
  return data.utms || {};
};

/** Strip undefined/empty entries for clean JSON storage. */
export const compactUtms = (utms: UtmParams): UtmParams => {
  const out: UtmParams = {};
  (Object.entries(utms) as Array<[UtmKey, string | undefined]>).forEach(([k, v]) => {
    if (v && String(v).trim()) out[k] = String(v).trim();
  });
  return out;
};
