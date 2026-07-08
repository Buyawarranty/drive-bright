// Shared quote email template.
// Uses the same transactional style as the welcome email: branded, useful,
// requested by the customer, and without discount/urgency/review signals.

export interface BrandedQuoteTemplateData {
  firstName?: string | null;
  vehicleDisplay: string;      // e.g. "Ford Focus"
  vehicleReg: string;          // e.g. "AB12 CDE"
  planName: string;            // e.g. "Platinum"
  coverPeriodDisplay: string;  // e.g. "12 months plus 2 additional months included"
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

const cleanDeliverabilityText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\bFREE\b/gi, 'included')
    .replace(/\bsave\b/gi, 'pay in full adjustment')
    .replace(/\bsavings?\b/gi, 'pay in full adjustment')
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

export function renderBrandedQuoteEmail(data: BrandedQuoteTemplateData): string {
  const firstName = escapeHtml(cleanDeliverabilityText(data.firstName || '').trim() || 'there');
  const vehicleDisplay = escapeHtml(cleanDeliverabilityText(data.vehicleDisplay || 'your vehicle'));
  const vehicleReg = escapeHtml(cleanDeliverabilityText(data.vehicleReg || ''));
  const planName = escapeHtml(cleanDeliverabilityText(data.planName || 'Platinum'));
  const coverPeriod = escapeHtml(cleanDeliverabilityText(data.coverPeriodDisplay || ''));
  const senderName = escapeHtml(cleanDeliverabilityText((data.senderName || '').trim() || 'Buyawarranty Customer Care'));
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

  const regBit = vehicleReg ? ` (${vehicleReg})` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your warranty details</title>
  <style>
    @media only screen and (max-width:600px){
      .baw-wrap{padding:16px 10px!important;}
      .baw-card{padding:24px 18px!important;}
      .baw-row-label,.baw-row-value{display:block!important;width:100%!important;text-align:left!important;}
      .baw-row-value{padding-top:4px!important;}
      .baw-cta{display:block!important;text-align:center!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">The warranty details you requested are included below.</div>
  <div class="baw-wrap" style="background-color:#f5f6f8;padding:30px 15px;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="text-align:center;padding:10px 0 25px;">
        <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" style="max-width:240px;height:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
      </div>

      <div class="baw-card" style="background-color:#ffffff;border-radius:8px;padding:35px 30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <h1 style="color:#1d3a8a;font-size:24px;font-weight:700;margin:0 0 8px 0;line-height:1.3;">Your warranty details</h1>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:16px 0 0 0;">Hi <strong>${firstName}</strong>,</p>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:12px 0 0 0;">Thanks for sharing the details for your ${vehicleDisplay}${regBit}. I have included the summary below for your records.</p>
        ${priceLine ? `<div style="margin-top:24px;padding:16px 20px;background-color:#f9fafb;border-left:4px solid #eb6b1f;border-radius:4px;"><p style="margin:0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Plan amount</p><p style="margin:4px 0 0 0;color:#1d3a8a;font-size:20px;font-weight:700;">${escapeHtml(priceLine)}</p></div>` : ''}
      </div>

      <div class="baw-card" style="background-color:#ffffff;border-radius:8px;padding:30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <h2 style="color:#1d3a8a;font-size:18px;font-weight:700;margin:0 0 20px 0;">Warranty summary</h2>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;width:45%;">Vehicle</td>
            <td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">${vehicleDisplay}${regBit}</td>
          </tr>
          <tr>
            <td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Plan</td>
            <td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">${planName}</td>
          </tr>
          ${coverPeriod ? `<tr><td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Cover period</td><td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">${coverPeriod}</td></tr>` : ''}
          ${data.claimLimit ? `<tr><td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Claim limit</td><td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">£${Number(data.claimLimit).toLocaleString()} per claim</td></tr>` : ''}
          ${data.excessAmount !== null && data.excessAmount !== undefined ? `<tr><td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Excess</td><td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">£${Number(data.excessAmount)}</td></tr>` : ''}
          ${data.labourRate ? `<tr><td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Labour rate</td><td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;font-weight:600;text-align:right;">Up to £${Number(data.labourRate)}/hr</td></tr>` : ''}
          ${data.mileage ? `<tr><td class="baw-row-label" style="padding:12px 0;color:#6b7280;font-size:14px;">Mileage on file</td><td class="baw-row-value" style="padding:12px 0;color:#1f2937;font-size:14px;font-weight:600;text-align:right;">${Number(data.mileage).toLocaleString()}</td></tr>` : ''}
        </table>
      </div>

      <div class="baw-card" style="background-color:#ffffff;border-radius:8px;padding:30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <h2 style="color:#1d3a8a;font-size:18px;font-weight:700;margin:0 0 12px 0;">Review your details</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 20px 0;">You can open your warranty details here when you are ready.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${quoteLink}" class="baw-cta" style="display:inline-block;background-color:#eb6b1f;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:6px;font-size:16px;font-weight:700;">Open warranty details</a>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0;">Link: <a href="${quoteLink}" style="color:#1d3a8a;text-decoration:underline;">buyawarranty.co.uk</a></p>
      </div>

      <div class="baw-card" style="background-color:#ffffff;border-radius:8px;padding:30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <h2 style="color:#1d3a8a;font-size:18px;font-weight:700;margin:0 0 8px 0;">Need help?</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px 0;">Reply to this email and our team will help. You can also call us on <a href="tel:03302295040" style="color:#1f2937;text-decoration:none;">0330 229 5040</a>.</p>
        <p style="color:#1f2937;font-size:15px;line-height:1.6;margin:0;">Kind regards,<br><strong>${senderName}</strong></p>
      </div>

      <div style="text-align:center;padding:20px 10px;">
        <p style="margin:0;color:#6b7280;font-size:13px;"><a href="https://buyawarranty.co.uk" style="color:#1d3a8a;text-decoration:none;font-weight:600;">buyawarranty.co.uk</a></p>
        <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">Buy A Warranty Limited, company 10314863, Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
