// Shared quote email template.
import { formatClaimLimit } from "./claim-limit-display.ts";
//
// Concise personal quote with an early action and a visible fallback link.
// Keep requested quote delivery and sender attribution unchanged. Presentation
// alone cannot guarantee inbox placement in any mail client.

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
  const quoteHref = escapeHtml(quoteLink);
  const customerEmailRaw = (data.customerEmail || '').trim().toLowerCase();
  // Default: NO unsubscribe on 1:1 transactional quotes — it's a Promotions signal.
  const includeUnsubscribe = data.includeUnsubscribe === true;

  const monthlyNum = data.monthlyPrice ? Number(data.monthlyPrice) : null;
  const payInFullNum = data.payInFullPrice ? Number(data.payInFullPrice) : null;
  const savingsNum = data.savings ? Number(data.savings) : null;
  const monthlyTotalNum = data.totalPrice
    ? Number(data.totalPrice)
    : (monthlyNum ? Math.round(monthlyNum * 12) : null);

  const claimLimitStr = data.claimLimit ? `${formatClaimLimit(data.claimLimit)} per claim` : null;
  const excessStr = data.excessAmount !== null && data.excessAmount !== undefined ? `£${Number(data.excessAmount)}` : null;
  const labourStr = data.labourRate ? `£${Number(data.labourRate)} per hour` : null;
  const mileageStr = data.mileage ? `${Number(data.mileage).toLocaleString()} miles` : null;

  const priceLines: string[] = [];
  if (monthlyNum) {
    priceLines.push(
      `<p style="margin:0 0 6px 0;font-size:16px;font-weight:600;color:#111827;">Pay monthly</p>` +
      `<p style="margin:0 0 10px 0;color:#111827;line-height:1.25;"><strong style="font-size:30px;">£${monthlyNum.toFixed(2)}</strong> <span style="font-size:15px;color:#4b5563;">per month</span></p>` +
      `<p style="margin:0;font-size:14px;color:#4b5563;">12 interest free payments</p>` +
      (monthlyTotalNum ? `<p style="margin:10px 0 0 0;padding-top:10px;border-top:1px solid #e5e7eb;font-size:15px;color:#111827;">Total for ${durationLabel} of cover: <strong>£${monthlyTotalNum.toLocaleString()}</strong></p>` : '')
    );
  }
  if (payInFullNum) {
    priceLines.push(
      `<p style="margin:0 0 6px 0;font-size:16px;font-weight:600;color:#111827;">Pay in full</p>` +
      `<p style="margin:0 0 10px 0;color:#111827;line-height:1.25;"><strong style="font-size:30px;">£${payInFullNum.toLocaleString()}</strong> <span style="font-size:15px;color:#4b5563;">total</span></p>` +
      `<p style="margin:0;font-size:14px;color:#4b5563;">One payment for ${durationLabel} of cover</p>` +
      (savingsNum && savingsNum >= 2 ? `<p style="margin:10px 0 0 0;padding-top:10px;border-top:1px solid #e5e7eb;font-size:15px;color:#0b57d0;"><strong>Save £${savingsNum.toLocaleString()}</strong> compared with paying monthly</p>` : '')
    );
  }
  const priceHtml = priceLines
    .map((line) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 10px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;"><tr><td style="padding:14px 16px;">${line}</td></tr></table>`)
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

  const supabaseUrl = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
  const unsubscribeHref = customerEmailRaw
    // Must be trimmed + lower-cased: the unsubscribe function normalises the
    // address before checking the token, so a capitalised address here produced
    // a token it rejected as an invalid link.
    ? `${supabaseUrl}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(customerEmailRaw.trim().toLowerCase())}&token=${encodeURIComponent(btoa(customerEmailRaw.trim().toLowerCase() + '_baw_unsub_2024'))}`
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

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 10px 0;"><tr><td bgcolor="#ff7a00" style="background:#ff7a00;border-radius:4px;text-align:center;">
      <a href="${quoteHref}" style="display:inline-block;padding:14px 24px;border:1px solid #ff7a00;border-radius:4px;color:#1a1a1a;font-size:16px;font-weight:700;text-decoration:none;">View and continue your quote</a>
    </td></tr></table>
    <p style="margin:0 0 24px 0;font-size:13px;line-height:1.5;"><a href="${quoteHref}" style="color:#0b57d0;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(quoteLink)}</a></p>

    ${priceHtml ? `<p style="margin:0 0 12px 0;font-size:18px;"><strong>Your quote for ${durationLabel} of cover</strong></p>${priceHtml}` : ''}

    <p style="margin:0 0 8px 0;"><strong>Your ${planName} cover</strong></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px 0;">
      ${summaryHtml}
    </table>

    <p style="margin:0 0 8px 0;"><strong>About your cover</strong></p>
    <p style="margin:0 0 14px 0;">${planName} covers thousands of mechanical and electrical parts, including the engine, gearbox, electrics, cooling, steering and suspension, subject to the plan terms.</p>
    <p style="margin:0 0 14px 0;">Use any VAT registered UK garage, with approved parts and labour paid directly to your garage. Your warranty is transferable if you sell your car.</p>

    ${attachmentsLine}

    <p style="margin:0 0 14px 0;">Rated Excellent on Trustpilot. You also have 14 days to cancel for a full refund.</p>

    <p style="margin:0 0 14px 0;">Have a question? Reply to this email or call <a href="tel:03302295040" style="color:#0b57d0;text-decoration:underline;">0330 229 5040</a>${vehicleReg ? ` and quote <strong>${vehicleReg}</strong>` : ''}. Our sales team is available Monday to Friday, 9am to 6pm, and Saturday, 12pm to 4pm.</p>

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
