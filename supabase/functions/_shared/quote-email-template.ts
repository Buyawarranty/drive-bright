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
  const savings = data.savings && data.savings > 0 ? `£${Number(data.savings).toFixed(0)}` : null;

  const priceLine = monthly && payInFull
    ? `From ${monthly} per month, or ${payInFull} paid upfront${savings ? ` (saves ${savings})` : ''}`
    : monthly
    ? `From ${monthly} per month`
    : payInFull
    ? `${payInFull} paid upfront`
    : '';

  const detailRows: string[] = [];
  if (coverPeriod) detailRows.push(`<tr><td style="padding:6px 0;font-size:14px;color:#333333;">Cover period</td><td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;font-weight:600;">${coverPeriod}</td></tr>`);
  if (data.claimLimit) detailRows.push(`<tr><td style="padding:6px 0;font-size:14px;color:#333333;">Claim limit</td><td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;font-weight:600;">£${Number(data.claimLimit).toLocaleString()} per claim</td></tr>`);
  if (data.excessAmount !== null && data.excessAmount !== undefined) detailRows.push(`<tr><td style="padding:6px 0;font-size:14px;color:#333333;">Excess</td><td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;font-weight:600;">£${Number(data.excessAmount)}</td></tr>`);
  if (data.labourRate) detailRows.push(`<tr><td style="padding:6px 0;font-size:14px;color:#333333;">Labour rate</td><td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;font-weight:600;">up to £${Number(data.labourRate)}/hr</td></tr>`);
  if (data.mileage) detailRows.push(`<tr><td style="padding:6px 0;font-size:14px;color:#333333;">Mileage on file</td><td style="padding:6px 0;font-size:14px;color:#111111;text-align:right;font-weight:600;">${Number(data.mileage).toLocaleString()}</td></tr>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your ${vehicleDisplay} warranty quote</title>
<style type="text/css">
@media only screen and (max-width:600px){
  .baw-pad{padding-left:20px!important;padding-right:20px!important;}
  .baw-h1{font-size:20px!important;}
}
</style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.55;color:#111111;margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your ${vehicleDisplay} warranty quote details are ready to review.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
  <tr><td class="baw-pad" style="padding:0 24px 20px 24px;">
    <a href="https://buyawarranty.co.uk" target="_blank" style="text-decoration:none;">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buyawarranty" width="150" style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
    </a>
  </td></tr>
  <tr><td class="baw-pad" style="padding:0 24px 8px 24px;">
    <h1 class="baw-h1" style="font-size:22px;font-weight:700;color:#111111;margin:0 0 6px 0;line-height:1.3;">
      Your ${vehicleDisplay} warranty quote
    </h1>
    <p style="font-size:15px;color:#555555;margin:0;">Hi ${firstName}, here are the details you asked for.</p>
  </td></tr>
  <tr><td class="baw-pad" style="padding:20px 24px 4px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #eaeaea;border-radius:8px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#666666;text-transform:uppercase;letter-spacing:.5px;">${planName} plan${vehicleReg ? ` &bull; ${vehicleReg}` : ''}</p>
        ${priceLine ? `<p style="margin:0 0 10px 0;font-size:16px;color:#111111;font-weight:600;">${escapeHtml(priceLine)}</p>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${detailRows.join('')}
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="baw-pad" align="left" style="padding:22px 24px 6px 24px;">
    <a href="${quoteLink}" target="_blank" style="display:inline-block;background:#FF7A00;color:#ffffff;padding:13px 22px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
      Review your quote
    </a>
    <p style="font-size:13px;color:#777777;margin:10px 0 0 0;">Or open this link: <a href="${quoteLink}" style="color:#555555;text-decoration:underline;word-break:break-all;">${quoteLink}</a></p>
  </td></tr>
  <tr><td class="baw-pad" style="padding:18px 24px 0 24px;">
    <p style="margin:0 0 10px 0;font-size:15px;color:#333333;">Any questions? Just reply to this email or call us on <a href="tel:03302295040" style="color:#111111;text-decoration:underline;">0330 229 5040</a> (Mon&ndash;Fri).</p>
    <p style="margin:16px 0 0 0;font-size:15px;color:#333333;">Kind regards,<br/>${senderName}<br/><span style="color:#777777;font-size:13px;">Buyawarranty</span></p>
  </td></tr>
  <tr><td class="baw-pad" style="padding:24px 24px 8px 24px;">
    <hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 12px 0;" />
    <p style="font-size:11px;color:#999999;margin:0;line-height:1.5;">
      Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Company number 10314863. Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
