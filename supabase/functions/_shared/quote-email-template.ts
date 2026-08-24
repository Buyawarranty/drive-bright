// Shared quote email template.
//
// Deliberately plain / letter-style so Gmail files it under Primary rather than
// Promotions. It reads like a personal email from the agent who prepared it:
//   - no hero images, mascots or logos
//   - no big coloured CTA buttons
//   - no discount pills, urgency wording or unsubscribe footer on 1:1 mail
// All the information is preserved (both payment options, cover summary,
// what's included, quote link, contact details) using plain text and simple
// rows, which renders identically on Gmail, Outlook, Apple Mail, iOS and
// Android.

export interface BrandedQuoteTemplateData {
  firstName?: string | null;
  vehicleDisplay: string;
  vehicleReg: string;
  planName: string;
  coverPeriodDisplay: string;
  monthlyPrice?: number | null;
  payInFullPrice?: number | null;
  savings?: number | null;
  totalPrice?: number | null;
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
  if (!match) return coverPeriodDisplay || '1 year';
  const months = parseInt(match[1], 10);
  if (!months) return coverPeriodDisplay || '1 year';
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${months} months`;
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
  const savingsNum = data.savings ? Number(data.savings) : null;
  const monthlyTotalNum = data.totalPrice
    ? Number(data.totalPrice)
    : (monthlyNum ? Math.round(monthlyNum * 12) : null);

  const claimLimitStr = data.claimLimit ? `£${Number(data.claimLimit).toLocaleString()} per claim` : null;
  const excessStr = data.excessAmount !== null && data.excessAmount !== undefined ? `£${Number(data.excessAmount)}` : null;
  const labourStr = data.labourRate ? `£${Number(data.labourRate)} per hour` : null;
  const mileageStr = data.mileage ? `${Number(data.mileage).toLocaleString()} miles` : null;

  const savingsPct = savingsNum && monthlyTotalNum
    ? Math.round((savingsNum / monthlyTotalNum) * 100)
    : null;

  const priceLines: string[] = [];
  if (monthlyNum) {
    priceLines.push(
      `<p style="margin:0 0 4px 0;font-size:16px;color:#111827;"><strong>Pay monthly &mdash; £${monthlyNum.toFixed(2)} / month</strong></p>` +
      `<p style="margin:0;color:#4b5563;font-size:14px;">12 interest-free payments${monthlyTotalNum ? ` &middot; Total £${monthlyTotalNum.toLocaleString()}` : ''}</p>`
    );
  }
  if (payInFullNum) {
    priceLines.push(
      `<p style="margin:0 0 4px 0;font-size:16px;color:#111827;"><strong>Pay in full &mdash; £${payInFullNum.toLocaleString()}</strong></p>` +
      `<p style="margin:0;color:#4b5563;font-size:14px;">One payment, nothing else to pay${savingsNum && savingsNum > 0 ? ` &middot; Save £${savingsNum.toLocaleString()} vs monthly${savingsPct ? ` (${savingsPct}%)` : ''}` : ''}</p>`
    );
  }
  const priceHtml = priceLines
    .map((line) => `<div style="margin:0 0 14px 0;padding:12px 14px;background:#f9fafb;border-left:3px solid #0b57d0;border-radius:4px;">${line}</div>`)
    .join('');

  const summaryLines: Array<[string, string]> = [
    ['Vehicle', vehicleDisplay + (vehicleReg ? ` (${vehicleReg})` : '')],
  ];
  if (mileageStr) summaryLines.push(['Mileage', mileageStr]);
  summaryLines.push(['Cover period', durationLabel]);
  if (claimLimitStr) summaryLines.push(['Claim limit', claimLimitStr]);
  if (excessStr) summaryLines.push(['Excess', excessStr]);
  if (labourStr) summaryLines.push(['Labour rate', labourStr]);

  const summaryHtml = summaryLines.map(([label, value]) => `
    <tr>
      <td style="padding:5px 16px 5px 0;color:#4b5563;font-size:15px;line-height:1.55;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}:</td>
      <td style="padding:5px 0;color:#111827;font-size:15px;line-height:1.55;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const included = [
    'Engine, gearbox, clutch and drivetrain',
    'Electrics, ECUs, sensors and diagnostics',
    'Turbo, fuel and cooling systems',
    'Air conditioning, steering and suspension',
    'Any VAT-registered garage in the UK &mdash; or we can help you find one',
    'Approved parts and labour paid directly to your garage',
    'Claims support 7 days a week',
    'Transferable if you sell your car',
  ];
  const includedHtml = included
    .map((item) => `<p style="margin:0 0 7px 0;font-size:15px;line-height:1.5;"><span style="color:#0b57d0;font-weight:600;margin-right:6px;">✓</span>${item}</p>`)
    .join('');

  const supabaseUrl = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
  const unsubscribeHref = customerEmailRaw
    ? `${supabaseUrl}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(customerEmailRaw)}&token=${encodeURIComponent(btoa(customerEmailRaw + '_baw_unsub_2024'))}`
    : 'https://buyawarranty.co.uk/contact';

  const attachmentsLine = data.attachmentsNote
    ? `<p style="margin:0 0 14px 0;">${data.attachmentsNote}</p>`
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

    <p style="margin:0 0 14px 0;">Thanks for getting in touch. I&rsquo;ve put together your <strong>${planName}</strong> warranty quote for your <strong>${vehicleDisplay}</strong>${vehicleReg ? ` (${vehicleReg})` : ''}, based on the details you provided.</p>

    ${attachmentsLine}

    ${priceHtml ? `<p style="margin:0 0 8px 0;"><strong>Your quote</strong></p>${priceHtml}` : ''}

    <p style="margin:0 0 8px 0;"><strong>Your ${planName} cover</strong></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px 0;">
      ${summaryHtml}
    </table>

    <p style="margin:0 0 8px 0;"><strong>What&rsquo;s included with ${planName}</strong></p>
    <p style="margin:0 0 8px 0;">Your ${planName} warranty covers thousands of mechanical and electrical parts, including:</p>
    <div style="margin:0 0 14px 0;">${includedHtml}</div>

    <p style="margin:0 0 14px 0;">Rated Excellent on Trustpilot. You also have 14 days to cancel for a full refund.</p>

    <p style="margin:0 0 14px 0;">You can review and continue with your quote here:<br>
      <a href="${quoteLink}" style="color:#0b57d0;text-decoration:underline;word-break:break-all;">${escapeHtml(quoteLink)}</a>
    </p>

    <p style="margin:0 0 14px 0;">Prefer to talk it through? Call us on <a href="tel:03302295040" style="color:#0b57d0;text-decoration:underline;">0330 229 5040</a>${vehicleReg ? ` and quote <strong>${vehicleReg}</strong>` : ''} &mdash; we&rsquo;re happy to answer any questions about the cover before you decide. We&rsquo;re open Monday to Saturday, 9am&ndash;6pm.</p>

    <p style="margin:0 0 4px 0;">Kind regards,</p>
    <p style="margin:0 0 18px 0;"><strong>${senderName}</strong><br>Buyawarranty</p>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.55;border-top:1px solid #e5e7eb;padding-top:12px;">
      Buy A Warranty Limited &middot; Established 2016 &middot; Company No. 10314683<br>
      Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.${includeUnsubscribe && customerEmailRaw ? ` &middot; <a href="${unsubscribeHref}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>` : ''}
    </p>

  </div>
</body>
</html>`;
}
