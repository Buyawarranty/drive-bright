import { describe, expect, it } from 'vitest';
import { activeStaffRecipient, passwordRenewalDue } from '../../supabase/functions/_shared/staff-password-rules';

describe('Staff password renewal rules', () => {
  it('renews after three calendar months, not ninety days', () => {
    expect(passwordRenewalDue('2026-10-21T21:46:00.000Z')).toBe('2027-01-21T21:46:00.000Z');
    expect(passwordRenewalDue('2026-01-31T12:00:00.000Z')).toBe('2026-04-30T12:00:00.000Z');
  });
  it('emails only active linked staff, including sales agents', () => {
    const staff = { email: 'agent@example.com', is_active: true, user_id: 'staff-id' };
    expect(activeStaffRecipient(staff)).toBe(true);
    expect(activeStaffRecipient({ ...staff, is_active: false })).toBe(false);
    expect(activeStaffRecipient({ ...staff, archived_at: '2026-10-01' })).toBe(false);
    expect(activeStaffRecipient({ ...staff, access_expires_at: '2026-10-01' }, Date.parse('2026-10-21'))).toBe(false);
  });
});