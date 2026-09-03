// Single source of truth for "is this address allowed to receive marketing?".
// Any function that sends promotional / reminder / campaign mail MUST call this,
// so an unsubscribe applies to every marketing email type, not just campaigns.

export type MarketingTier = 'off' | 'essentials' | 'all';

/** Template ids / email types that are marketing (never transactional). */
const MARKETING_TEMPLATE_HINTS = [
  'promo',
  'discount',
  'offer',
  'marketing',
  'newsletter',
  'campaign',
  'abandoned',
  'reminder',
  'last_chance',
  'return_discount',
  'winback',
  'win_back',
  'upsell',
  'renewal_promo',
];

/** True when a template id / email type should be treated as marketing. */
export function isMarketingTemplate(templateId?: string | null): boolean {
  const id = (templateId || '').toLowerCase();
  if (!id) return false;
  return MARKETING_TEMPLATE_HINTS.some((h) => id.includes(h));
}

/**
 * Returns the marketing tier for an address:
 *  - 'off'        => send nothing promotional at all
 *  - 'essentials' => only essential mail (renewal / policy / claims)
 *  - 'all'        => fully subscribed
 */
export async function getMarketingTier(
  supabase: any,
  rawEmail: string,
): Promise<MarketingTier> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) return 'off';

  // 1. Explicit unsubscribe list (unsubscribe link, staff toggle, bulk import).
  const { data: unsub } = await supabase
    .from('email_unsubscribes')
    .select('frequency')
    .ilike('email', email)
    .limit(5);
  if (unsub && unsub.length > 0) {
    const freqs = unsub.map((r: any) => (r.frequency || 'off').toLowerCase());
    if (freqs.includes('off')) return 'off';
    if (freqs.includes('essentials')) return 'essentials';
    return 'off';
  }

  // 2. Consent record withdrawn.
  const { data: consent } = await supabase
    .from('email_consents')
    .select('consent_given, unsubscribed_at')
    .ilike('email', email)
    .maybeSingle();
  if (consent && (consent.consent_given === false || consent.unsubscribed_at)) {
    return 'off';
  }

  // 3. Marketing audience opted out.
  const { data: audience } = await supabase
    .from('marketing_audience')
    .select('is_subscribed, unsubscribed_at, frequency')
    .ilike('email', email)
    .limit(1);
  const row = audience?.[0];
  if (row && (row.is_subscribed === false || row.unsubscribed_at)) return 'off';
  if (row && (row.frequency || '').toLowerCase() === 'essentials') return 'essentials';

  return 'all';
}

/**
 * Convenience guard. `essential` marks renewal/policy/claims mail that the
 * 'essentials' tier still wants. Fully unsubscribed addresses are always blocked.
 */
export async function isMarketingSuppressed(
  supabase: any,
  email: string,
  opts: { essential?: boolean } = {},
): Promise<boolean> {
  const tier = await getMarketingTier(supabase, email);
  if (tier === 'off') return true;
  if (tier === 'essentials') return !opts.essential;
  return false;
}
