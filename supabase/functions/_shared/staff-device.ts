import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export async function hashStaffDevice(value: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function staffDeviceAllowed(db: SupabaseClient, req: Request, userId: string): Promise<boolean> {
  const hash = await hashStaffDevice(req.headers.get('x-staff-device') || '');
  const { data, error } = await db.rpc('staff_device_access', { p_user_id: userId, p_hash: hash });
  return !error && data?.allowed === true;
}