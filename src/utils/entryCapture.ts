/**
 * First-touch entry capture (SESSION scoped).
 *
 * Records how the visitor arrived at the site on the FIRST page of this visit:
 *   - entry_referrer      full referrer URL (empty string when there was none)
 *   - entry_referrer_host hostname of the referrer, for quick reporting
 *   - entry_landing_page  the first path they landed on (e.g. /blog/...)
 *
 * This is what lets management split organic leads into:
 *   ORGANIC W  — arrived from a web source (Google/Bing organic search, a blog
 *                link, an organic social post, a directory, any referrer)
 *   ORGANIC O  — arrived with no referrer at all: typed the address in or used
 *                a bookmark, i.e. offline demand (billboard, van livery, radio,
 *                word of mouth, printed leaflet).
 *
 * Session scoped on purpose: a later visit must not inherit the first visit's
 * referrer, exactly like the UTM session mirror.
 */

const STORAGE_KEY = 'baw_entry';

export interface EntryContext {
  entry_referrer: string;
  entry_referrer_host: string;
  entry_landing_page: string;
  entry_at: number;
}

const read = (): EntryContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EntryContext;
  } catch {
    return null;
  }
};

const hostOf = (url: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

/**
 * Capture the entry context once per session. Safe to call on every route
 * change — after the first write it is a no-op, so the first-touch referrer is
 * never overwritten by internal navigation.
 */
export const captureEntryContext = (): void => {
  if (typeof window === 'undefined') return;
  if (read()) return;
  try {
    const referrer = document.referrer || '';
    const data: EntryContext = {
      entry_referrer: referrer,
      entry_referrer_host: hostOf(referrer),
      entry_landing_page: window.location.pathname || '/',
      entry_at: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage blocked — attribution simply stays unknown
  }
};

/** Payload merged into cart_metadata / lead attribution writes. */
export const getEntryPayload = (): Record<string, string> => {
  const data = read();
  if (!data) return {};
  return {
    entry_referrer: data.entry_referrer,
    entry_referrer_host: data.entry_referrer_host,
    entry_landing_page: data.entry_landing_page,
  };
};
