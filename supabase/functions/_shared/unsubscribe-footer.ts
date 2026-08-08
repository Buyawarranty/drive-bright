// Shared marketing-email footer with a clear, two-choice unsubscribe block.
// Used by every marketing/reminder email so the styling and wording stay consistent.

const BRAND_LINK = '#0066cc';

export interface UnsubFooterOptions {
  /** Heading of the opt-out card. */
  title?: string;
  /** Supporting sentence under the heading. */
  blurb?: string;
  /** Label for the softer opt-out (essentials only). Pass null to hide it. */
  softLabel?: string | null;
  /** Final grey line explaining why they got the email. */
  reason?: string;
  /** Show the website / email / phone contact row above the card. */
  includeContactRow?: boolean;
}

export function buildUnsubscribeLinks(rawEmail: string) {
  const clean = (rawEmail || '').trim().toLowerCase();
  // URL-safe base64 — Outlook SafeLinks / Gmail proxies mangle +, / and =
  const token = btoa(clean + '_baw_unsub_2024')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(clean)}&token=${token}`;
  return {
    /** Full opt-out of all marketing email. */
    unsubscribeUrl: `${base}&choice=off`,
    /** Essentials only — keeps renewal/policy mail, stops promos and chasers. */
    essentialsUrl: `${base}&choice=essentials`,
  };
}

export function buildContactRow(): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 8px 0 20px;">
        <tr>
          <td align="center" class="baw-stack" style="padding: 6px; border-right: 1px solid #e6ebf1; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
            <a href="https://buyawarranty.co.uk" style="color: ${BRAND_LINK}; text-decoration: none;">&#127760;&nbsp; buyawarranty.co.uk</a>
          </td>
          <td align="center" class="baw-stack" style="padding: 6px; border-right: 1px solid #e6ebf1; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
            <a href="mailto:support@buyawarranty.co.uk" style="color: ${BRAND_LINK}; text-decoration: none;">&#9993;&nbsp; support@buyawarranty.co.uk</a>
          </td>
          <td align="center" class="baw-stack" style="padding: 6px; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
            <a href="tel:03302295040" style="color: ${BRAND_LINK}; text-decoration: none;">&#128222;&nbsp; 0330 229 5040</a>
          </td>
        </tr>
      </table>`;
}

/**
 * Renders the standard opt-out card (light blue panel, envelope icon, two clear links)
 * plus the grey "why you received this" line.
 */
export function buildUnsubscribeFooter(email: string, options: UnsubFooterOptions = {}): string {
  const { unsubscribeUrl, essentialsUrl } = buildUnsubscribeLinks(email);
  const title = options.title ?? 'No longer interested in your warranty quote?';
  const blurb = options.blurb ?? "That's okay. You can stop these reminders or unsubscribe from all marketing emails.";
  const softLabel = options.softLabel === undefined ? 'Stop these reminders' : options.softLabel;
  const reason = options.reason ?? 'You received this email because you requested a warranty quote from Buy A Warranty.';

  const softLink = softLabel
    ? `<a href="${essentialsUrl}" style="color: ${BRAND_LINK}; font-size: 13px; font-weight: 600; text-decoration: underline; display: inline-block; padding: 6px 0;">${softLabel}</a>
        <span class="baw-hide-sm" style="color: #cbd5e1; padding: 0 10px;">|</span><br class="baw-only-sm" />`
    : '';

  return `
      ${options.includeContactRow ? buildContactRow() : ''}
      <div class="baw-pad-sm" style="background-color: #f1f5fb; border-radius: 10px; padding: 20px; margin: 8px 0 16px; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
          <tr>
            <td width="64" valign="top" class="baw-hide-sm" style="padding-right: 14px;">
              <div style="width: 52px; height: 52px; border-radius: 26px; background-color: #dce7f8; text-align: center; line-height: 52px; font-size: 24px; color: #0A2A66;">&#9993;</div>
            </td>
            <td valign="top">
              <p style="color: #1a1a1a; font-size: 15px; font-weight: 700; margin: 0 0 6px 0;">${title}</p>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">${blurb}</p>
              ${softLink}
              <a href="${unsubscribeUrl}" style="color: ${BRAND_LINK}; font-size: 13px; font-weight: 600; text-decoration: underline; display: inline-block; padding: 6px 0;">Unsubscribe from marketing emails</a>
            </td>
          </tr>
        </table>
      </div>
      <p style="color: #aab7c4; font-size: 11px; line-height: 1.5; margin: 0; text-align: center; font-family: Arial, Helvetica, sans-serif;">
        ${reason}
      </p>`;
}
