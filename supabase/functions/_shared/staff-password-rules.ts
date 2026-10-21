export function passwordRenewalDue(changedAt: string): string {
  const date = new Date(changedAt);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 3);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}

export function activeStaffRecipient(staff: { is_active: boolean; archived_at?: string | null; access_expires_at?: string | null; email: string; user_id?: string | null }, now = Date.now()) {
  return staff.is_active && !staff.archived_at && !!staff.user_id &&
    (!staff.access_expires_at || Date.parse(staff.access_expires_at) > now) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email);
}