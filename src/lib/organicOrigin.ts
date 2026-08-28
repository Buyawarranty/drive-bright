/**
 * Splits ORGANIC (non-paid) leads into the two things management actually
 * wants to tell apart:
 *
 *   ORGANIC W (web)     — the visit came from somewhere on the web: Google or
 *                         Bing organic search, one of our blog/guide pages
 *                         shared elsewhere, an organic social post, a
 *                         directory, any referring site.
 *   ORGANIC O (offline) — the visit had NO referrer: the address was typed in
 *                         or opened from a bookmark. That is offline demand —
 *                         billboard, van livery, radio, leaflet, word of mouth.
 *
 * Paid leads keep their existing Google / Meta / Bing / TikTok sources; this
 * only refines the organic bucket and never changes lead_source itself.
 */

export type OrganicKind = 'web' | 'offline' | 'unknown';

export interface OrganicOrigin {
  kind: OrganicKind;
  /** Short badge label. */
  label: string;
  /** Whether this came from real captured referrer data or was inferred. */
  estimated: boolean;
  /** Tooltip lines. */
  detail: string[];
}

const OWN_HOSTS = ['buyawarranty.co.uk', 'drive-bright.lovable.app', 'localhost'];

const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'qwant.', 'baidu.', 'yandex.'];

const isOwnHost = (host: string) => OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

const describeHost = (host: string): string => {
  if (!host) return 'No referrer';
  if (SEARCH_HOSTS.some((s) => host.startsWith(s) || host.includes(`.${s}`))) return `Organic search — ${host}`;
  if (isOwnHost(host)) return `Our own site — ${host}`;
  return `Referring site — ${host}`;
};

/**
 * Classify a lead's cart_metadata. Only call this for organic leads
 * (lead_source 'website' / empty).
 */
export const classifyOrganicOrigin = (metadata: Record<string, any> | null | undefined): OrganicOrigin => {
  const m = metadata || {};
  const hasEntry = Object.prototype.hasOwnProperty.call(m, 'entry_referrer');
  const referrer: string = String(m.entry_referrer || '');
  const host: string = String(m.entry_referrer_host || '');
  const landing: string = String(m.entry_landing_page || '');

  if (hasEntry) {
    const detail: string[] = [describeHost(host)];
    if (referrer) detail.push(`Referrer: ${referrer}`);
    if (landing) detail.push(`Landed on: ${landing}`);
    if (referrer) {
      return { kind: 'web', label: 'Organic W', estimated: false, detail: ['Organic — web', ...detail] };
    }
    return {
      kind: 'offline',
      label: 'Organic O',
      estimated: false,
      detail: [
        'Organic — offline',
        'No referrer: address typed in or bookmarked',
        'Typically billboard, van livery, radio, leaflet or word of mouth',
        ...(landing ? [`Landed on: ${landing}`] : []),
      ],
    };
  }

  // Legacy rows captured before entry tracking: best-effort inference.
  const legacyWebSignal = !!(m.utm_source || m.utm_medium || m.utm_campaign || m.fb_referrer);
  if (legacyWebSignal) {
    return {
      kind: 'web',
      label: 'Organic W',
      estimated: true,
      detail: ['Organic — web (estimated)', 'Campaign / referrer tags present but no ad click ID'],
    };
  }
  return {
    kind: 'unknown',
    label: 'Organic',
    estimated: true,
    detail: ['Organic — origin not captured', 'Lead recorded before web/offline tracking was added'],
  };
};
