// Shared quote email template.
//
// Deliberately plain / letter-style. Gmail's Promotions classifier weights:
//   - hero images & mascots
//   - large coloured CTA buttons
//   - "Save £X (Y%)" style pills
//   - "Why choose us" marketing blocks
//   - unsubscribe footers on 1:1 mail
// This template avoids every one of those. It reads like a personal reply
// from a human agent so Gmail files it under Primary / Updates instead of
// Promotions. All the same information is preserved (price, plan, summary,
// quote link, contact details) — just presented without marketing chrome.

export interface BrandedQuoteTemplateData {
  firstName?: string | null;
  vehicleDisplay: string;
  vehicleReg: string;
  planName: string;
  coverPeriodDisplay: string;
  monthlyPrice?: number | null;
  payInFullPrice?: number | null;
  savings?: number | null;
  claimLimit?: number | null;
  excessAmount?: number | null;
  labourRate?: number | null;
  mileage?: number | null;
  quoteLink: string;
  senderName?: string | null;
  customerEmail?: string | null;
  includeUnsubscribe?: boolean;
  attachmentsNote?: string | null;
}

const cleanDeliverabilityText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\bFREE\b/gi, 'included')
    .replace(/\blimited time\b/gi, '')
    .replace(/\burgent\b/gi, '')
    .replace(/\bexpires?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const deriveDurationLabel = (coverPeriodDisplay: string): string => {
  const match = String(coverPeriodDisplay || '').match(/(\d+)\s*months?/i);
  if (!match) return coverPeriodDisplay || '1 year of cover';
  const months = parseInt(match[1], 10);
  if (!months) return coverPeriodDisplay || '1 year of cover';
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years > 1 ? 's' : ''} of cover`;
  }
  return `${months} months of cover`;
};

export function renderBrandedQuoteEmail(data: BrandedQuoteTemplateData): string {
  const firstName = escapeHtml(cleanDeliverabilityText(data.firstName || '').trim() || 'there');
  const vehicleDisplay = escapeHtml(cleanDeliverabilityText(data.vehicleDisplay || 'your vehicle'));
  const vehicleReg = escapeHtml(cleanDeliverabilityText(data.vehicleReg || ''));
  const planName = escapeHtml(cleanDeliverabilityText(data.planName || 'Platinum'));
  const coverPeriodRaw = cleanDeliverabilityText(data.coverPeriodDisplay || '');
  const durationLabel = escapeHtml(deriveDurationLabel(coverPeriodRaw));
  const senderName = escapeHtml(cleanDeliverabilityText((data.senderName || '').trim() || 'Buyawarranty Customer Care'));
  const quoteLink = data.quoteLink;
  const customerEmailRaw = (data.customerEmail || '').trim().toLowerCase();
  // Default: NO unsubscribe on 1:1 transactional quotes — it's a Promotions signal.
  const includeUnsubscribe = data.includeUnsubscribe === true;

  const monthlyNum = data.monthlyPrice ? Number(data.monthlyPrice) : null;
  const payInFullNum = data.payInFullPrice ? Number(data.payInFullPrice) : null;
  const monthlyStr = monthlyNum ? `£${monthlyNum.toFixed(2)}` : null;
  const payInFullStr = payInFullNum ? `£${payInFullNum.toFixed(0)}` : null;

  const claimLimitStr = data.claimLimit ? `£${Number(data.claimLimit).toLocaleString()} per claim` : null;
  const excessStr = data.excessAmount !== null && data.excessAmount !== undefined ? `£${Number(data.excessAmount)}` : null;
  const labourStr = data.labourRate ? `up to £${Number(data.labourRate)}/hr` : null;
  const mileageStr = data.mileage ? Number(data.mileage).toLocaleString() : null;

  const summaryLines: Array<[string, string]> = [
    ['Vehicle', vehicleDisplay + (vehicleReg ? ` (${vehicleReg})` : '')],
    ['Plan', `${planName} — ${durationLabel}`],
  ];
  if (monthlyStr) summaryLines.push(['Monthly', `${monthlyStr} per month (12 monthly payments)`]);
  if (payInFullStr) summaryLines.push(['Pay in full', `${payInFullStr}`]);
  if (claimLimitStr) summaryLines.push(['Claim limit', claimLimitStr]);
  if (excessStr) summaryLines.push(['Excess', excessStr]);
  if (labourStr) summaryLines.push(['Labour rate', labourStr]);
  if (mileageStr) summaryLines.push(['Mileage on file', `${mileageStr} miles`]);

  const summaryHtml = summaryLines.map(([label, value]) => `
    <tr>
      <td style="padding:4px 16px 4px 0;color:#4b5563;font-size:14px;line-height:1.55;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}:</td>
      <td style="padding:4px 0;color:#111827;font-size:14px;line-height:1.55;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const supabaseUrl = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
  const unsubscribeHref = customerEmailRaw
    ? `${supabaseUrl}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(customerEmailRaw)}&token=${encodeURIComponent(btoa(customerEmailRaw + '_baw_unsub_2024'))}`
    : 'https://buyawarranty.co.uk/contact';

  const attachmentsLine = data.attachmentsNote
    ? `<p style="margin:0 0 14px 0;color:#111827;font-size:15px;line-height:1.6;">${data.attachmentsNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Your warranty quote</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:24px 20px;font-size:15px;line-height:1.6;color:#111827;">

    <p style="margin:0 0 14px 0;">Hi ${firstName},</p>

    <p style="margin:0 0 14px 0;">Thanks for getting in touch — here are the details for your <strong>${planName}</strong> warranty on your <strong>${vehicleDisplay}</strong>${vehicleReg ? ` (${vehicleReg})` : ''}.</p>

    ${attachmentsLine}

    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px 0;">
      ${summaryHtml}
    </table>

    <p style="margin:0 0 14px 0;">You can review and continue with your quote here:<br>
      <a href="${quoteLink}" style="color:#0b57d0;text-decoration:underline;word-break:break-all;">${escapeHtml(quoteLink)}</a>
    </p>

    <p style="margin:0 0 14px 0;">If it's easier, give me a call on <a href="tel:03302295040" style="color:#0b57d0;text-decoration:underline;">0330 229 5040</a>${vehicleReg ? ` and quote <strong>${vehicleReg}</strong>` : ''} — we're open Monday to Friday 8:30am–6:00pm and Saturday 9:00am–1:00pm.</p>

    <p style="margin:0 0 4px 0;">Kind regards,</p>
    <p style="margin:0 0 18px 0;"><strong>${senderName}</strong><br>Buyawarranty</p>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.55;border-top:1px solid #e5e7eb;padding-top:12px;">
      Buy A Warranty Limited, company 10314683. Warranty House, 62 Berkhampsted Ave, Wembley, HA9 6DT.${includeUnsubscribe && customerEmailRaw ? ` &middot; <a href="${unsubscribeHref}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>` : ''}
    </p>

  </div>
</body>
</html>`;
}
