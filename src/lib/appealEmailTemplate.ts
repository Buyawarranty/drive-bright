/**
 * Appeal email template (customer-facing).
 * Built on the client so the claims team can PREVIEW the exact email before it
 * is sent, then posted to the send-appeal-email edge function.
 */

export interface AppealEmailInput {
  customerName?: string | null;
  registration?: string | null;
  intro: string;
  grounds: string;
  newEvidence?: string;
  /** Customer has agreed to an independent engineer review. */
  withIndependentReview: boolean;
  reviewerName?: string;
  reviewerUrl?: string;
  fee?: number;
  /** Page where the customer completes the inspection form and pays the fee. */
  paymentLink?: string;
  /** Page where the customer completes the appeal form (their statement/evidence). */
  appealFormLink?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const para = (s: string) => esc(s).replace(/\n/g, '<br/>');

export function buildAppealEmailSubject(registration?: string | null) {
  const reg = (registration || '').toUpperCase();
  return `Your claim appeal${reg ? ` — ${reg}` : ''}`;
}

export function buildAppealEmailHtml(input: AppealEmailInput): string {
  const {
    customerName,
    registration,
    intro,
    grounds,
    newEvidence,
    withIndependentReview,
    reviewerName,
    reviewerUrl,
    fee = 140,
    paymentLink,
    appealFormLink,
  } = input;

  const reg = (registration || '').toUpperCase();

  const button = (href: string, label: string, bg: string) => `
    <p style="text-align:center;margin:24px 0;">
      <a href="${href}" style="background:${bg};color:#ffffff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">${esc(label)}</a>
    </p>`;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto;">
    <div style="background:#1e3a5f;padding:22px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:21px;">Buy a Warranty</h1>
      <p style="color:#94a3b8;margin:5px 0 0 0;font-size:13px;">Claims Department — Final appeal</p>
    </div>

    <div style="padding:28px;background:#ffffff;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px 0;">
        Hi ${esc(customerName || 'there')},
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px 0;">${para(intro)}</p>

      ${reg ? `<p style="color:#374151;font-size:14px;margin:0 0 16px 0;"><strong>Vehicle:</strong> ${esc(reg)}</p>` : ''}

      <div style="background:#f8fafc;border-left:4px solid #1e3a5f;padding:14px 16px;margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">
        <strong>Grounds for appeal</strong><br/>${para(grounds)}
        ${newEvidence && newEvidence.trim() ? `<br/><br/><strong>New evidence</strong><br/>${para(newEvidence)}` : ''}
      </div>

      ${
        appealFormLink
          ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
              Please complete the short appeal form below so we have your account of the fault in
              writing, along with any invoices, photos or service history you would like considered.
             </p>
             ${button(appealFormLink, 'Complete your appeal form', '#1e3a5f')}`
          : ''
      }

      ${
        withIndependentReview
          ? `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:8px 0 0 0;">
              <p style="color:#111827;font-size:15px;font-weight:bold;margin:0 0 8px 0;">Independent review</p>
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px 0;">
                You have asked for an independent engineer's review${reviewerName ? ` (${esc(reviewerName)})` : ''}.
                Whichever independent inspector is available will be booked.
              </p>
              <ul style="color:#374151;font-size:14px;line-height:1.7;padding-left:18px;margin:0 0 8px 0;">
                <li>The inspection fee of <strong>£${fee.toFixed(2)}</strong> is paid to the independent inspection company. It is not a Buy a Warranty charge and we keep none of it.</li>
                <li>Inspections take on average <strong>7 to 14 working days</strong>.</li>
                <li>The engineer's findings are the <strong>full and final decision</strong> and binding on both of us.</li>
              </ul>
              ${reviewerUrl ? `<p style="margin:0;font-size:13px;"><a href="${reviewerUrl}" style="color:#1e3a5f;">Read about the inspection company</a></p>` : ''}
              ${paymentLink ? button(paymentLink, `Complete inspection form & pay £${fee.toFixed(2)}`, '#f97316') : ''}
             </div>`
          : `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:8px 0 0 0;color:#374151;font-size:14px;line-height:1.6;">
              <strong>No independent inspection</strong><br/>
              You have chosen to appeal without an independent engineer's review, so there is nothing
              to pay. Our claims manager will review your appeal and everything you send us, and we
              will write to you with the outcome.
             </div>`
      }

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0 0;">
        Links expire in 30 days. Any questions, reply to this email or call us on 0330 229 5045
        (Mon–Sat, 9am–6pm).
      </p>
      <p style="color:#1f2937;font-size:14px;margin:18px 0 0 0;">
        Kind regards,<br/><strong style="color:#1e3a5f;">Buy a Warranty Claims Team</strong>
      </p>
    </div>

    <div style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#64748b;font-size:12px;margin:0;">
        Buy a Warranty Claims Department · 0330 229 5045 · claims@buyawarranty.co.uk
      </p>
    </div>
  </div>`;
}
