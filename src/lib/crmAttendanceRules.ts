export const CRM_ACTIVE_WINDOW_MS = 60_000;
export const CRM_CONNECTION_WINDOW_MS = 90_000;

export function isMeaningfulCrmEvent(type: string, trusted: boolean, visible: boolean, relevantTarget: boolean): boolean {
  return trusted && visible && relevantTarget && ['click', 'input', 'change', 'paste', 'scroll'].includes(type);
}

export function crmAttendanceStatus(session: { ended_at: string | null; last_seen_at: string; last_activity_at: string | null; visible: boolean } | undefined, now: number): 'active' | 'idle' | 'offline' {
  if (!session || session.ended_at || now - Date.parse(session.last_seen_at) >= CRM_CONNECTION_WINDOW_MS) return 'offline';
  if (session.visible && session.last_activity_at && now - Date.parse(session.last_activity_at) < CRM_ACTIVE_WINDOW_MS) return 'active';
  return 'idle';
}

export function canViewCrmAttendance(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'sales_manager';
}