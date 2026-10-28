import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Deliberately independent of approved-browser settings, credentials and RPCs.
export async function revokeOtherStaffSessions(db: SupabaseClient, token: string) {
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { status: 401, body: { error: 'Sign in first' } };
  const { data: staff, error: staffError } = await db.from('admin_users')
    .select('user_id,is_active,archived_at,access_expires_at')
    .eq('user_id', data.user.id).maybeSingle();
  if (staffError) return { status: 503, body: { error: 'Unable to check staff access' } };
  if (!staff || !staff.is_active || staff.archived_at ||
    (staff.access_expires_at && Date.parse(staff.access_expires_at) <= Date.now())) {
    return { status: 403, body: { error: 'Active staff access required' } };
  }
  const { error: revokeError } = await db.auth.admin.signOut(token, 'others');
  if (revokeError) return { status: 503, body: { error: 'Unable to secure session' } };
  return { status: 200, body: { revoked: true } };
}