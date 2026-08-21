/**
 * Careers recruitment email copy.
 *
 * Kept in one place so the acknowledgement and the automatic
 * five-working-day rejection always read consistently.
 */

const BRAND = 'Buyawarranty.co.uk';
const CAREERS_EMAIL = 'careers@buyawarranty.co.uk';
const CAREERS_URL = 'https://buyawarranty.co.uk/careers/';

export const CAREERS_FROM = `${BRAND} Careers <${CAREERS_EMAIL}>`;

const firstName = (fullName: string) =>
  (fullName || '').trim().split(/\s+/)[0] || 'there';

const shell = (bodyHtml: string) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;border:1px solid #e7e5e0;">
            <tr>
              <td style="padding:24px 28px 8px 28px;">
                <div style="font-size:18px;font-weight:700;color:#1f2937;">${BRAND}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Recruitment Team</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 24px 28px;font-size:15px;line-height:1.6;color:#374151;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 22px 28px;border-top:1px solid #eeece7;font-size:12px;line-height:1.5;color:#9ca3af;">
                ${BRAND} &middot; <a href="mailto:${CAREERS_EMAIL}" style="color:#9ca3af;">${CAREERS_EMAIL}</a><br>
                If you'd prefer we didn't keep your details, just reply to this email and we'll remove them.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function acknowledgementEmail(fullName: string, role: string) {
  return {
    subject: `We've got your application — ${role}`,
    html: shell(`
      <p>Hi ${firstName(fullName)},</p>
      <p>Thanks for applying for the <strong>${role}</strong> role at ${BRAND} — your CV has landed safely with us.</p>
      <p>Our team reviews every application personally. If we'd like to take things further, we'll be in touch
      within <strong>5 working days</strong> to arrange a chat. If you haven't heard from us by then, we'll let you
      know either way so you're never left waiting.</p>
      <p>Thanks again for your interest in joining us.</p>
      <p style="margin-bottom:0;">Kind regards,<br><strong>The Recruitment Team</strong><br>${BRAND}</p>
    `),
  };
}

export function rejectionEmail(fullName: string, role: string) {
  return {
    subject: `Your application to Buyawarranty — ${role}`,
    html: shell(`
      <p>Hi ${firstName(fullName)},</p>
      <p>Thank you for taking the time to apply for the <strong>${role}</strong> role at ${BRAND}, and for sharing
      your CV with us.</p>
      <p>We've now reviewed your application carefully alongside the others we've received. On this occasion we've
      decided to take other candidates forward, so we won't be progressing your application any further.</p>
      <p>This isn't a reflection of your ability or experience — we simply had a strong field and a limited number of
      places. We know how much effort goes into applying, and we're genuinely grateful you considered us.</p>
      <p>We'd be glad to keep your details on file for six months in case something more suitable opens up. We recruit
      regularly, so do keep an eye on <a href="${CAREERS_URL}" style="color:#c2410c;">buyawarranty.co.uk/careers</a> —
      you're very welcome to apply again.</p>
      <p>We wish you every success with your search.</p>
      <p style="margin-bottom:0;">Kind regards,<br><strong>The Recruitment Team</strong><br>${BRAND}</p>
    `),
  };
}
