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
  if (s === 'google_ad' || s === 'google_ads' || s === 'google' || s === 'google ads') return 'G';
  if (s === 'social_ad' || s === 'facebook' || s === 'facebook_ad' || s === 'facebook_ads' || s === 'meta') return 'F';
  if (s === 'bing_ad' || s === 'bing_ads' || s === 'bing') return 'B';
  if (s === 'tiktok_ad' || s === 'tiktok_ads' || s === 'tiktok') return 'T';
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
 *
 * A quote-link sale keeps the marketing channel visible: "Q/G" is a quote-link
 * sale from a Google lead, "S-Q/F" an agent-closed quote link from a Facebook
 * lead. When the channel is unknown the plain "Q" is used.
 */
export function saleSubjectPrefix(opts: {
  letter: SourceLetter;
  isAgentSale?: boolean;
  isQuote?: boolean;
}): string {
  const channel = opts.letter === 'Q' ? null : opts.letter;
  const core = opts.isQuote ? (channel ? `Q/${channel}` : 'Q') : opts.letter;
  return opts.isAgentSale ? `S-${core}` : core;
}

/** Clear wording for email subjects; avoids ambiguous codes such as G/F/O. */
export function saleSubjectKind(opts: {
  letter: SourceLetter;
  isAgentSale?: boolean;
  isQuote?: boolean;
}): string {
  const channel: Record<SourceLetter, string> = {
    G: 'Google',
    F: 'Facebook',
    B: 'Bing',
    T: 'TikTok',
    O: 'Website',
    R: 'Referral',
    P: 'Phone',
    Q: 'Live quote',
  };
  const channelName = channel[opts.letter];
  if (opts.isQuote) return `${channelName === 'Live quote' ? '' : `${channelName} `}quote sale`.trim();
  return opts.isAgentSale ? `${channelName} lead sale` : `${channelName} direct sale`;
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

/** Human label for a full prefix such as "S-Q/G" or "O". */
export function describeSalePrefix(prefix: string): string {
  const isAgent = prefix.startsWith('S-');
  const core = isAgent ? prefix.slice(2) : prefix;
  const [route, channel] = core.split('/');
  const parts: string[] = [];
  parts.push(SOURCE_LETTER_LABEL[route as SourceLetter] || route);
  if (channel) parts.push(`from ${SOURCE_LETTER_LABEL[channel as SourceLetter] || channel}`);
  parts.push(isAgent ? '— agent closed' : '— self-serve web sale');
  return parts.join(' ');
}
