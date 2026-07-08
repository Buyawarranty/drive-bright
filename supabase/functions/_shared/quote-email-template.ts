// Shared branded quote email template.
// Designed to land in the PRIMARY inbox (not Promotions/Spam):
//   - single CTA button, no promo code, no discount language, no urgency
//   - light brand accents only (logo + one orange button), white background
//   - conversational 1-to-1 tone, plain-text alt provided by caller
//   - no List-Unsubscribe header on caller side (transactional 1:1 send)

export interface BrandedQuoteTemplateData {
  firstName?: string | null;
  vehicleDisplay: string;      // e.g. "Ford Focus"
  vehicleReg: string;          // e.g. "AB12 CDE"
  planName: string;            // e.g. "Platinum"
  coverPeriodDisplay: string;  // e.g. "12 months plus 2 months FREE"
  monthlyPrice?: number | null;
  payInFullPrice?: number | null;
  savings?: number | null;
  claimLimit?: number | null;
  excessAmount?: number | null;
  labourRate?: number | null;
  mileage?: number | null;
  quoteLink: string;           // pre-validated absolute URL
  senderName?: string | null;  // e.g. "Sarah" — falls back to Customer Care
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function renderBrandedQuoteEmail(data: BrandedQuoteTemplateData): string {
  const firstName = escapeHtml((data.firstName || '').trim() || 'there');
  const vehicleDisplay = escapeHtml(data.vehicleDisplay || 'your vehicle');
  const vehicleReg = escapeHtml(data.vehicleReg || '');
  const planName = escapeHtml(data.planName || 'Platinum');
  const coverPeriod = escapeHtml(data.coverPeriodDisplay || '');
  const senderName = escapeHtml((data.senderName || '').trim() || 'Buyawarranty Customer Care');
  const quoteLink = data.quoteLink;

  const monthly = data.monthlyPrice ? `£${Number(data.monthlyPrice).toFixed(2)}` : null;
  const payInFull = data.payInFullPrice ? `£${Number(data.payInFullPrice).toFixed(0)}` : null;

  const priceLine = monthly && payInFull
    ? `From ${monthly} per month, or ${payInFull} paid upfront.`
    : monthly
    ? `From ${monthly} per month.`
    : payInFull
    ? `${payInFull} paid upfront.`
    : '';

  const detailBits: string[] = [];
  if (coverPeriod) detailBits.push(`Cover period: ${coverPeriod}`);
  if (data.claimLimit) detailBits.push(`Claim limit: £${Number(data.claimLimit).toLocaleString()} per claim`);
  if (data.excessAmount !== null && data.excessAmount !== undefined) detailBits.push(`Excess: £${Number(data.excessAmount)}`);
  if (data.labourRate) detailBits.push(`Labour rate: up to £${Number(data.labourRate)}/hr`);
  if (data.mileage) detailBits.push(`Mileage on file: ${Number(data.mileage).toLocaleString()}`);
  const detailsBlock = detailBits.length
    ? detailBits.map(b => `<p style="margin:0 0 4px 0;">${escapeHtml(b)}</p>`).join('')
    : '';

  const regBit = vehicleReg ? ` (${vehicleReg})` : '';

  // Plain, conversational, 1-to-1 style HTML.
  // No logo image, no coloured CTA button, no bordered pricing table — all
  // strong Gmail Promotions signals. Single inline text link only.
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Your ${vehicleDisplay} quote</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111111;margin:0;padding:16px;background:#ffffff;">
<div style="max-width:600px;">
<p style="margin:0 0 12px 0;">Hi ${firstName},</p>
<p style="margin:0 0 12px 0;">Thanks for the details on your ${vehicleDisplay}${regBit}. Here's the ${planName} quote you asked me to send over:</p>
${priceLine ? `<p style="margin:0 0 12px 0;">${escapeHtml(priceLine)}</p>` : ''}
${detailsBlock ? `<div style="margin:0 0 12px 0;">${detailsBlock}</div>` : ''}
<p style="margin:0 0 12px 0;">You can review everything and continue here: <a href="${quoteLink}" style="color:#1a0dab;">${quoteLink}</a></p>
<p style="margin:0 0 12px 0;">If anything doesn't look right, just hit reply and I'll sort it. You can also call me on 0330 229 5040 (Mon&ndash;Fri).</p>
<p style="margin:16px 0 0 0;">Thanks,<br/>${senderName}<br/>Buyawarranty</p>
<p style="margin:24px 0 0 0;font-size:11px;color:#999999;">Buy A Warranty Limited, company 10314863, Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.</p>
</div>
</body></html>`;
}
