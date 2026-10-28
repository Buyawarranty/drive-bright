import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';

export async function secureStaffSignIn(accessToken: string): Promise<void> {
  const result = await withTimeout(supabase.functions.invoke('staff-device-access', {
    body: { action: 'revoke-others' },
    headers: { Authorization: `Bearer ${accessToken}` },
  }), 15000, 'Staff session check');
  if (result.error || result.data?.revoked !== true) {
    throw new Error('Unable to secure your staff session. Please sign in again.');
  }
}