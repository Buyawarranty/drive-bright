import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';

type AttendanceKind = 'open' | 'activity' | 'ping' | 'hidden' | 'left_crm' | 'logout';
let endSession: (() => Promise<void>) | undefined;

export function registerAttendanceLogout(handler: () => Promise<void>) {
  endSession = handler;
  return () => { if (endSession === handler) endSession = undefined; };
}

export async function recordCrmAttendance(sessionId: string, kind: AttendanceKind, tab?: string) {
  const { error, data } = await withTimeout(supabase.functions.invoke('crm-attendance', {
    body: { action: 'record', sessionId, kind, tab: tab || null },
  }), 8000, 'Attendance recording');
  if (error || data?.error) throw new Error('Unable to record CRM attendance');
}

export async function signOutWithAttendance() {
  // Attendance must not trap someone in their account during an outage.
  await endSession?.().catch(() => undefined);
  return supabase.auth.signOut({ scope: 'local' });
}