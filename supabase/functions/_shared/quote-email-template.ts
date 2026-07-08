// Shared quote email template.
// Branded, responsive HTML email for the buyawarranty quote:
// tighter price block (no "FROM" wording — the price shown IS the price the
// customer selected), tick-list benefits with unlimited claims, "Why choose us"
// tick list, working unsubscribe link.

export interface BrandedQuoteTemplateData {
  firstName?: string | null;
  vehicleDisplay: string;
  vehicleReg: string;
  planName: string;
  coverPeriodDisplay: string;      // e.g. "24 months" — used to derive "2-year cover"
  monthlyPrice?: number | null;    // pass only what the customer selected when possible
  payInFullPrice?: number | null;
  savings?: number | null;
  claimLimit?: number | null;
  excessAmount?: number | null;
  labourRate?: number | null;
  mileage?: number | null;
  quoteLink: string;
  senderName?: string | null;
  customerEmail?: string | null;   // required for the unsubscribe link
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

// "24 months" → "2-year cover"; "36 months plus 2 additional months included" → "3-year cover"
const deriveDurationLabel = (coverPeriodDisplay: string): string => {
  const match = String(coverPeriodDisplay || '').match(/(\d+)\s*months?/i);
  if (!match) return coverPeriodDisplay || '1-year cover';
  const months = parseInt(match[1], 10);
  if (!months) return coverPeriodDisplay || '1-year cover';
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years}-year cover`;
  }
  return `${months}-month cover`;
};

const tickRow = (label: string): string => `
  <tr>
    <td valign="top" style="padding:6px 8px 6px 0;width:22px;">
      <span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:50%;background:#16a34a;color:#ffffff;font-size:12px;font-weight:800;text-align:center;">&#10003;</span>
    </td>
    <td valign="middle" style="padding:6px 0;color:#0f172a;font-size:14px;line-height:1.45;">${label}</td>
  </tr>`;

export function renderBrandedQuoteEmail(data: BrandedQuoteTemplateData): string {
  const firstName = escapeHtml(cleanDeliverabilityText(data.firstName || '').trim() || 'there');
  const vehicleDisplay = escapeHtml(cleanDeliverabilityText(data.vehicleDisplay || 'your vehicle'));
  const vehicleReg = escapeHtml(cleanDeliverabilityText(data.vehicleReg || ''));
  const planName = escapeHtml(cleanDeliverabilityText(data.planName || 'Platinum'));
  const coverPeriodRaw = cleanDeliverabilityText(data.coverPeriodDisplay || '');
  const durationLabel = escapeHtml(deriveDurationLabel(coverPeriodRaw));
  const coverPeriod = escapeHtml(coverPeriodRaw);
  const senderName = escapeHtml(cleanDeliverabilityText((data.senderName || '').trim() || 'Buyawarranty Customer Care'));
  const quoteLink = data.quoteLink;
  const customerEmailRaw = (data.customerEmail || '').trim().toLowerCase();

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

  // Tick benefit list (replaces the old 4-column strip)
  const benefitTicks: string[] = [
    `${planName} cover`,
    durationLabel,
    'Unlimited claims per year',
    ...(claimLimitStr ? [`Up to ${claimLimitStr}`] : []),
    ...(excessStr ? [escapeHtml(excessStr)] : []),
    'Cover at any VAT-registered garage in the UK',
  ];
  const benefitTicksHtml = benefitTicks.map(tickRow).join('');

  const whyChooseTicks: string[] = [
    'Trusted by UK drivers',
    'Rated Excellent on Trustpilot',
    'Easy claims, fast payout',
    'Cover at any VAT-registered garage in the UK',
    'Cancel within 14 days for a full refund',
    'UK-based customer care team',
  ];
  const whyChooseHtml = whyChooseTicks.map(tickRow).join('');

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
      <td class="baw-row-label" style="padding:12px 4px;color:#4b5563;font-size:14px;${i < summaryRows.length - 1 ? 'border-bottom:1px solid #f1f2f4;' : ''}width:45%;">${escapeHtml(r.label)}</td>
      <td class="baw-row-value" style="padding:12px 4px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;${i < summaryRows.length - 1 ? 'border-bottom:1px solid #f1f2f4;' : ''}">${escapeHtml(r.value)}</td>
    </tr>
  `).join('');

  // Unsubscribe link — resolves via the existing handle-email-unsubscribe function.
  const supabaseUrl = (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
  const unsubscribeHref = customerEmailRaw
    ? `${supabaseUrl}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(customerEmailRaw)}&token=${encodeURIComponent(btoa(customerEmailRaw + '_baw_unsub_2024'))}`
    : 'https://buyawarranty.co.uk/contact';

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
      .baw-wrap{padding:14px 8px!important;}
      .baw-card{padding:20px 16px!important;}
      .baw-price-monthly,.baw-price-upfront{display:block!important;width:100%!important;text-align:center!important;padding:8px 0!important;}
      .baw-price-or{display:block!important;width:100%!important;text-align:center!important;padding:6px 0!important;}
      .baw-price-num{font-size:30px!important;}
      .baw-price-caption{font-size:12px!important;}
      .baw-cta{display:block!important;width:100%!important;box-sizing:border-box!important;padding:15px 20px!important;font-size:16px!important;}
      .baw-row-label,.baw-row-value{font-size:13px!important;padding:10px 4px!important;}
      .baw-hero-headline{font-size:20px!important;}
      .baw-quote-ref{display:block!important;text-align:left!important;margin-top:6px!important;}
      .baw-hero-text,.baw-hero-panda{display:block!important;width:100%!important;text-align:center!important;padding:0!important;}
      .baw-hero-panda img{margin:12px auto 0!important;max-width:150px!important;}
      .baw-section-title{font-size:16px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your ${planName} warranty quote for ${vehicleDisplay}${regBit}.</div>
  <div class="baw-wrap" style="background-color:#f4f5f7;padding:24px 15px;">
    <div style="max-width:640px;margin:0 auto;">

      <!-- Logo -->
      <div style="text-align:center;padding:4px 0 18px;">
        <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" width="200" style="max-width:200px;height:auto;display:inline-block;" />
      </div>

      <!-- Greeting card -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:22px 26px;margin-bottom:14px;border:1px solid #e5e7eb;">
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td valign="top" style="font-size:15px;color:#0f172a;font-weight:700;">Hi ${firstName},</td>
            <td valign="top" align="right" class="baw-quote-ref" style="font-size:13px;color:#4b5563;">Quote reference: <strong style="color:#0f172a;">${vehicleReg || '—'}</strong></td>
          </tr>
        </table>
        <p style="margin:8px 0 0 0;color:#4b5563;font-size:14px;line-height:1.55;">Thanks for requesting a warranty quote for your <strong>${vehicleDisplay}</strong>.</p>
      </div>

      <!-- Hero / price -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:26px 26px;margin-bottom:14px;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td class="baw-hero-text" valign="middle" style="width:68%;padding-right:12px;">
              <h1 class="baw-hero-headline" style="margin:0;color:#0b1e4c;font-size:22px;font-weight:800;line-height:1.25;">Your warranty quote is ready</h1>
              <p style="margin:8px 0 4px 0;color:#0f172a;font-size:14px;line-height:1.5;"><strong>${planName}</strong> ${durationLabel} for your <strong>${vehicleDisplay}</strong></p>
              ${vehicleReg ? `<p style="margin:0;color:#6b7280;font-size:13px;">Registration: <strong style="color:#0f172a;">${vehicleReg}</strong></p>` : ''}
            </td>
            <td class="baw-hero-panda" valign="middle" align="right" style="width:32%;">
              <img src="https://buyawarranty.co.uk/__l5e/assets-v1/8e594d61-d793-4d4a-85c9-73889a8850b2/panda-thumbs-up.png" alt="Buyawarranty mascot" width="130" style="max-width:130px;height:auto;display:inline-block;" />
            </td>
          </tr>
        </table>

        <!-- Price block (no "FROM" wording — this is the price they selected) -->
        <table role="presentation" width="100%" style="width:100%;margin:18px 0 4px 0;">
          <tr>
            ${monthlyStr ? `<td class="baw-price-monthly" align="center" valign="middle" style="width:${payInFullStr ? '45%' : '100%'};padding:6px 4px;">
              <div class="baw-price-num" style="color:#0b1e4c;font-size:34px;font-weight:800;line-height:1.05;">${monthlyStr}</div>
              <div class="baw-price-caption" style="color:#0b1e4c;font-size:13px;font-weight:600;margin-top:4px;">per month</div>
            </td>` : ''}
            ${monthlyStr && payInFullStr ? `<td class="baw-price-or" align="center" valign="middle" style="width:10%;color:#6b7280;font-size:13px;font-weight:600;">
              <div style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;border:1px solid #e5e7eb;background:#f9fafb;">or</div>
            </td>` : ''}
            ${payInFullStr ? `<td class="baw-price-upfront" align="center" valign="middle" style="width:${monthlyStr ? '45%' : '100%'};padding:6px 4px;">
              <div class="baw-price-num" style="color:#eb6b1f;font-size:34px;font-weight:800;line-height:1.05;">${payInFullStr}</div>
              <div class="baw-price-caption" style="color:#eb6b1f;font-size:13px;font-weight:600;margin-top:4px;">paid upfront</div>
            </td>` : ''}
          </tr>
        </table>

        <!-- Benefit tick list -->
        <table role="presentation" width="100%" style="width:100%;margin:16px 0 18px 0;">
          ${benefitTicksHtml}
        </table>

        <!-- CTA -->
        <table role="presentation" width="100%" style="width:100%;">
          <tr>
            <td align="center" style="padding:4px 0 6px 0;">
              <a href="${quoteLink}" class="baw-cta" style="display:inline-block;background-color:#eb6b1f;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:800;letter-spacing:0.2px;box-shadow:0 2px 0 rgba(179,79,20,0.35);">Continue with this quote</a>
            </td>
          </tr>
        </table>

        <p style="margin:12px 0 0 0;text-align:center;color:#4b5563;font-size:13px;line-height:1.5;">
          Prefer to speak to us? Call <a href="tel:03302295040" style="color:#0b1e4c;font-weight:700;">0330 229 5040</a>${regQuoteBit}.
        </p>
      </div>

      <!-- Summary card -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:22px 26px;margin-bottom:14px;border:1px solid #e5e7eb;">
        <h2 class="baw-section-title" style="margin:0 0 6px 0;color:#0b1e4c;font-size:17px;font-weight:800;">Your warranty summary</h2>
        <table role="presentation" width="100%" style="width:100%;margin-top:4px;">
          ${summaryHtml}
        </table>
      </div>

      <!-- Why choose us -->
      <div class="baw-card" style="background-color:#ffffff;border-radius:10px;padding:22px 26px;margin-bottom:14px;border:1px solid #e5e7eb;">
        <h2 class="baw-section-title" style="margin:0 0 10px 0;color:#0b1e4c;font-size:17px;font-weight:800;">Why choose us</h2>
        <table role="presentation" width="100%" style="width:100%;">
          ${whyChooseHtml}
        </table>
      </div>

      <!-- Help card -->
      <div class="baw-card" style="background-color:#eef3fb;border-radius:10px;padding:22px 26px;margin-bottom:14px;border:1px solid #dbe4f3;">
        <h2 class="baw-section-title" style="margin:0 0 6px 0;color:#0b1e4c;font-size:17px;font-weight:800;">Need help?</h2>
        <p style="margin:0 0 6px 0;color:#334155;font-size:14px;line-height:1.6;">Reply to this email or call our team on <a href="tel:03302295040" style="color:#0b1e4c;font-weight:700;">0330 229 5040</a>.</p>
        <p style="margin:0 0 12px 0;color:#334155;font-size:14px;line-height:1.6;">We're here Monday to Friday, 8:30am – 6:00pm and Saturday, 9:00am – 1:00pm.</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;">Kind regards,<br><strong>${senderName}</strong></p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:12px 10px 24px;">
        <p style="margin:0;"><a href="https://buyawarranty.co.uk" style="color:#0b1e4c;font-weight:700;font-size:14px;text-decoration:none;">buyawarranty.co.uk</a></p>
        <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.55;">Buy A Warranty Limited, company 10314683.<br>Warranty House, 62 Berkhampsted Ave, Wembley, HA9 6DT.</p>
        <p style="margin:10px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.55;">
          Don't want these emails? <a href="${unsubscribeHref}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
}
