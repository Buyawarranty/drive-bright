import { sendInternalNotification } from './send-internal-notification.ts';
import { activeStaffRecipient } from './staff-password-rules.ts';

export async function notifyActiveStaff(service: any, changed: boolean) {
  const recipients: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await service.from('admin_users')
      .select('email,is_active,archived_at,access_expires_at,user_id').eq('is_active', true)
      .order('id').range(offset, offset + 499);
    if (error) throw new Error('Unable to load active staff for email notices');
    for (const staff of data || []) if (activeStaffRecipient(staff)) recipients.push(staff.email.trim().toLowerCase());
    if (!data || data.length < 500) break;
  }
  const unique = [...new Set(recipients)];
  if (!unique.length) return { sent: 0, failed: 0 };
  const text = changed
    ? 'The shared gateway password for /auth and /sales-login has been updated. Please contact your manager for the current gateway password. Your personal password is separate and must be renewed every three months.'
    : 'Staff security reminder: please renew your personal login password every three months in Account settings. Please contact your manager for the current shared gateway password.';
  const result = await sendInternalNotification({
    to: unique, subject: changed ? 'Staff login: gateway password updated' : 'Staff login: password renewal reminder',
    text, html: `<h2>Staff login security</h2><p>${text}</p><p><a href="https://buyawarranty.co.uk/auth">Admin login</a> · <a href="https://buyawarranty.co.uk/sales-login">Staff and sales login</a></p>`,
    template: 'staff_password_notice', sourceFunction: 'login-gateway', maxAttempts: 2,
  });
  return { sent: result.perRecipient.filter(r => r.ok).length, failed: result.perRecipient.filter(r => !r.ok).length };
}