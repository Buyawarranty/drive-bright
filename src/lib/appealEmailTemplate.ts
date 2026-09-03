/**
 * Appeal invitation email template (customer-facing).
 * Simple invitation: a personalised message plus a button linking the
 * customer to the appeal form page. Built on the client so the claims team
 * can preview the exact email before it is sent.
 */

export const APPEAL_PAGE_URL = 'https://buyawarranty.co.uk/appeals/';

export interface AppealEmailInput {
  customerName?: string | null;
  registration?: string | null;
  /** Editable personal message written by the claims agent. */
  message: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const para = (s: string) => esc(s).replace(/\n/g, '<br/>');

export function buildAppealEmailSubject(registration?: string | null) {
  const reg = (registration || '').toUpperCase();
  return `Your claim appeal${reg ? ` — ${reg}` : ''}`;
}

export function buildAppealEmailHtml(input: AppealEmailInput): string {
  const { customerName, registration, message } = input;
  const reg = (registration || '').toUpperCase();

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto;">
    <div style="background:#1e3a5f;padding:22px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:21px;">Buy a Warranty</h1>
      <p style="color:#94a3b8;margin:5px 0 0 0;font-size:13px;">Claims Department — Appeal</p>
    </div>

    <div style="padding:28px;background:#ffffff;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px 0;">
        Hi ${esc(customerName || 'there')},
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px 0;">${para(message)}</p>

      ${reg ? `<p style="color:#374151;font-size:14px;margin:0 0 16px 0;"><strong>Vehicle:</strong> ${esc(reg)}</p>` : ''}

      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
        If you would like to appeal this decision, please complete the short appeal form below.
        Your appeal will be reviewed by our claims manager.
      </p>

      <p style="text-align:center;margin:24px 0;">
        <a href="${APPEAL_PAGE_URL}" style="background:#1e3a5f;color:#ffffff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Make an appeal</a>
      </p>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0 0;">
        Any questions, reply to this email or call us on 0330 229 5045 (Mon–Sat, 9am–6pm).
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
