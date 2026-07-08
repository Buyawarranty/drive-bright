// Shared quote email template.
// Branded, responsive HTML email matching the buyawarranty quote design:
// prominent price hero, orange CTA, benefit strip, summary table, help card.

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

  const monthlyNum = data.monthlyPrice ? Number(data.monthlyPrice) : null;
  const payInFullNum = data.payInFullPrice ? Number(data.payInFullPrice) : null;
  const monthlyStr = monthlyNum ? `£${monthlyNum.toFixed(2)}` : null;
  const payInFullStr = payInFullNum ? `£${payInFullNum.toFixed(0)}` : null;

  const claimLimitStr = data.claimLimit ? `£${Number(data.claimLimit).toLocaleString()} per claim` : null;
  const excessStr = data.excessAmount !== null && data.excessAmount !== undefined ? `£${Number(data.excessAmount)} excess` : null;
  const labourStr = data.labourRate ? `Up to £${Number(data.labourRate)}/hr` : null;
  const mileageStr = data.mileage ? Number(data.mileage).toLocaleString() : null;

  const regBit = vehicleReg ? ` (${vehicleReg})` : '';
  const regQuoteBit = vehicleReg ? ` and quote <strong>${vehicleReg}</strong>` : '';

  // Benefit strip cells
  const benefits: Array<{ label: string }> = [
    { label: `${planName} cover` },
    { label: coverPeriod || '12 months' },
    ...(claimLimitStr ? [{ label: `Up to ${claimLimitStr}` }] : []),
    ...(excessStr ? [{ label: excessStr }] : []),
  ];

  const benefitCells = benefits.map((b, i) => `
    <td align="center" style="padding:10px 8px;color:#1f2937;font-size:13px;font-weight:600;${i < benefits.length - 1 ? 'border-right:1px solid #e5e7eb;' : ''}">${escapeHtml(b.label)}</td>
  `).join('');

  const summaryRows = [
    { label: 'Vehicle', value: `${vehicleDisplay}` },
    { label: 'Registration', value: vehicleReg || '—' },
    { label: 'Plan', value: planName },
    ...(coverPeriod ? [{ label: 'Cover period', value: coverPeriod }] : []),
    ...(claimLimitStr ? [{ label: 'Claim limit', value: claimLimitStr }] : []),
    ...(excessStr ? [{ label: 'Excess', value: `£${Number(data.excessAmount)}` }] : []),
    ...(labourStr ? [{ label: 'Labour rate', value: labourStr }] : []),
    ...(mileageStr ? [{ label: 'Mileage on file', value: mileageStr }] : []),
  ];

  const summaryHtml = summaryRows.map((r, i) => `
    <tr>
      <td class="baw-row-label" style="padding:14px 4px;color:#4b5563;font-size:14px;${i < summaryRows.length - 1 ? 'border-bottom:1px solid #f1f2f4;' : ''}width:45%;">${escapeHtml(r.label)}</td>
      <td class="baw-row-value" style="padding:14px 4px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;${i < summaryRows.length - 1 ? 'border-bottom:1px solid #f1f2f4;' : ''}">${escapeHtml(r.value)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your warranty quote</title>
  <style>
    body{margin:0;padding:0;background-color:#f4f5f7;}
    a{text-decoration:none;}
    table{border-collapse:collapse;}
    img{border:0;outline:none;text-decoration:none;display:block;}
    @media only screen and (max-width:620px){
      .baw-wrap{padding:16px 10px!important;}
      .baw-card{padding:22px 18px!important;}
      .baw-price-monthly,.baw-price-upfront{display:block!important;width:100%!important;text-align:center!important;padding:6px 0!important;}
      .baw-price-or{display:block!important;width:100%!important;text-align:center!important;padding:6px 0!important;}
      .baw-price-num{font-size:40px!important;}
      .baw-cta{display:block!important;width:100%!important;box-sizing:border-box!important;}
      .baw-benefit-cell{display:block!important;width:100%!important;border-right:0!important;border-bottom:1px solid #e5e7eb!important;padding:12px 8px!important;}
      .baw-benefit-cell:last-child{border-bottom:0!important;}
      .baw-row-label,.baw-row-value{font-size:14px!important;}
      .baw-hero-headline{font-size:22px!important;}
      .baw-quote-ref{display:block!important;text-align:left!important;margin-top:6px!important;}
      .baw-hero-text,.baw-hero-panda{display:block!important;width:100%!important;text-align:center!important;padding:0!important;}
      .baw-hero-panda img{margin:14px auto 0!important;max-width:180px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your ${planName} warranty quote for ${vehicleDisplay}${regBit} — from ${monthlyStr || payInFullStr || 'a low price'} per month.</div>
  <div class="baw-wrap" style="background-color:#f4f5f7;padding:28px 15px;">
    <div style="max-width:680px;margin:0 auto;">

      <!-- Logo -->
      <div style="text-align:center;padding:6px 0 22px;">
        <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" width="220" style="max-width:220px;height:auto;display:inline-block;" />
      </div>

      <!-- Greeting card -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:24px 30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td valign="top" style="font-size:15px;color:#0f172a;font-weight:700;">Hi ${firstName},</td>
            <td valign="top" align="right" class="baw-quote-ref" style="font-size:13px;color:#4b5563;">Quote reference: <strong style="color:#0f172a;">${vehicleReg || '—'}</strong></td>
          </tr>
        </table>
        <p style="margin:10px 0 0 0;color:#4b5563;font-size:15px;line-height:1.55;">Thanks for requesting a warranty quote for your <strong>${vehicleDisplay}</strong>.</p>
      </div>

      <!-- Hero / price -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:32px 30px;margin-bottom:16px;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td class="baw-hero-text" valign="middle" style="width:64%;padding-right:12px;">
              <h1 class="baw-hero-headline" style="margin:0;color:#0b1e4c;font-size:26px;font-weight:800;line-height:1.25;">Your warranty quote is ready</h1>
              <p style="margin:10px 0 4px 0;color:#0f172a;font-size:15px;line-height:1.5;"><strong>${planName}</strong> warranty cover for your <strong>${vehicleDisplay}</strong></p>
              ${vehicleReg ? `<p style="margin:0;color:#6b7280;font-size:13px;">Registration: <strong style="color:#0f172a;">${vehicleReg}</strong></p>` : ''}
            </td>
            <td class="baw-hero-panda" valign="middle" align="right" style="width:36%;">
              <img src="https://buyawarranty.co.uk/__l5e/assets-v1/8e594d61-d793-4d4a-85c9-73889a8850b2/panda-thumbs-up.png" alt="Buyawarranty mascot giving a thumbs up" width="160" style="max-width:160px;height:auto;display:inline-block;" />
            </td>
          </tr>
        </table>


        <!-- Price block -->
        <table role="presentation" width="100%" style="width:100%;margin:22px 0 6px 0;">
          <tr>
            ${monthlyStr ? `<td class="baw-price-monthly" align="center" valign="middle" style="width:45%;padding:8px 4px;">
              <div style="color:#0b1e4c;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">From</div>
              <div class="baw-price-num" style="color:#0b1e4c;font-size:48px;font-weight:800;line-height:1.05;margin-top:4px;">${monthlyStr}</div>
              <div style="color:#0b1e4c;font-size:13px;font-weight:600;margin-top:4px;">per month</div>
            </td>` : ''}
            ${monthlyStr && payInFullStr ? `<td class="baw-price-or" align="center" valign="middle" style="width:10%;color:#6b7280;font-size:14px;font-weight:600;">
              <div style="display:inline-block;width:38px;height:38px;line-height:38px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;">or</div>
            </td>` : ''}
            ${payInFullStr ? `<td class="baw-price-upfront" align="center" valign="middle" style="width:45%;padding:8px 4px;">
              <div class="baw-price-num" style="color:#eb6b1f;font-size:48px;font-weight:800;line-height:1.05;">${payInFullStr}</div>
              <div style="color:#eb6b1f;font-size:13px;font-weight:600;margin-top:4px;">paid upfront</div>
            </td>` : ''}
          </tr>
        </table>

        <!-- Benefit strip -->
        <table role="presentation" width="100%" style="width:100%;margin:18px 0 22px 0;background:#f6f8fb;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>${benefitCells}</tr>
        </table>

        <!-- CTA -->
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td align="center" style="padding:4px 0 8px 0;">
              <a href="${quoteLink}" class="baw-cta" style="display:inline-block;background-color:#eb6b1f;color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:8px;font-size:17px;font-weight:800;letter-spacing:0.2px;box-shadow:0 2px 0 rgba(179,79,20,0.35);">Continue with this quote</a>
            </td>
          </tr>
        </table>

        <p style="margin:14px 0 0 0;text-align:center;color:#4b5563;font-size:13px;line-height:1.5;">
          Prefer to speak to us? Call <a href="tel:03302295040" style="color:#0b1e4c;font-weight:700;">0330 229 5040</a>${regQuoteBit}.
        </p>
      </div>

      <!-- Summary card -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:26px 30px;margin-bottom:16px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 8px 0;color:#0b1e4c;font-size:18px;font-weight:800;">Your warranty summary</h2>
        <table role="presentation" width="100%" style="width:100%;margin-top:6px;">
          ${summaryHtml}
        </table>
      </div>

      <!-- Help card -->
      <div class="baw-card" style="background-color:#eef3fb;border-radius:10px;padding:24px 30px;margin-bottom:16px;border:1px solid #dbe4f3;">
        <h2 style="margin:0 0 8px 0;color:#0b1e4c;font-size:18px;font-weight:800;">Need help?</h2>
        <p style="margin:0 0 8px 0;color:#334155;font-size:14px;line-height:1.6;">Reply to this email or call our team on <a href="tel:03302295040" style="color:#0b1e4c;font-weight:700;">0330 229 5040</a>.</p>
        <p style="margin:0 0 14px 0;color:#334155;font-size:14px;line-height:1.6;">We're here Monday to Friday, 8:30am – 6:00pm and Saturday, 9:00am – 1:00pm.</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;">Kind regards,<br><strong>${senderName}</strong></p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:12px 10px 24px;">
        <p style="margin:0;"><a href="https://buyawarranty.co.uk" style="color:#0b1e4c;font-weight:700;font-size:14px;text-decoration:none;">buyawarranty.co.uk</a></p>
        <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.55;">Buy A Warranty Limited, company 10314683.<br>Warranty House, 62 Berkhampsted Ave, Wembley, HA9 6DT.</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}
