/**
 * Sale notification subject prefixes.
 *
 * Every "New Sale" email to management must say where the sale came from with a
 * single, consistent letter:
 *
 *   G  = Google ad        (gclid present / lead_source google_ad)
 *   F  = Facebook / social ad (fbclid present / lead_source social_ad)
 *   B  = Bing ad
 *   T  = TikTok ad
 *   O  = Organic (website, no ad click)
 *   R  = Referral
 *   P  = Phone enquiry
 *   Q  = Live quote link
 *
 * When a sales agent closed the sale the letter is prefixed with S- so both
 * facts are in one glance: "S-G" is an agent sale from a Google ad, "S-O" an
 * agent sale from organic traffic. A plain letter means a self-serve web sale.
 */

export type SourceLetter = 'G' | 'F' | 'B' | 'T' | 'O' | 'R' | 'P' | 'Q';

/** Map a lead_source / acquisition value to its single source letter. */
export function sourceLetterFromLeadSource(leadSource?: string | null): SourceLetter {
  const s = (leadSource || '').toLowerCase().trim();
  if (s === 'google_ad' || s === 'google' || s === 'google ads') return 'G';
  if (s === 'social_ad' || s === 'facebook' || s === 'facebook_ad' || s === 'meta') return 'F';
  if (s === 'bing_ad' || s === 'bing') return 'B';
  if (s === 'tiktok_ad' || s === 'tiktok') return 'T';
  if (s === 'referral' || s === 'partner') return 'R';
  if (s === 'phone' || s === 'email') return 'P';
  if (s === 'live_quote' || s === 'quote') return 'Q';
  // website / organic / other / unknown all read as Organic
  return 'O';
}

/** Map a detected ad-click source (from gclid/fbclid etc.) to its letter. */
export function sourceLetterFromAdSource(
  adSource?: 'google' | 'facebook' | 'bing' | 'tiktok' | null,
): SourceLetter {
  switch (adSource) {
    case 'google': return 'G';
    case 'facebook': return 'F';
    case 'bing': return 'B';
    case 'tiktok': return 'T';
    default: return 'O';
  }
}

/**
 * Build the subject prefix used after "New Sale".
 * Agent sales get the S- prefix so management can tell staff sales apart.
 */
export function saleSubjectPrefix(opts: {
  letter: SourceLetter;
  isAgentSale?: boolean;
  isQuote?: boolean;
}): string {
  if (opts.isQuote) return opts.isAgentSale ? 'S-Q' : 'Q';
  return opts.isAgentSale ? `S-${opts.letter}` : opts.letter;
}

/** Human label for the letter, for use inside the email body. */
export const SOURCE_LETTER_LABEL: Record<SourceLetter, string> = {
  G: 'Google ad',
  F: 'Facebook / social ad',
  B: 'Bing ad',
  T: 'TikTok ad',
  O: 'Organic',
  R: 'Referral',
  P: 'Phone enquiry',
  Q: 'Live quote link',
};
