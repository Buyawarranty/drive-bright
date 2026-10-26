import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';

export async function staffDeviceRequest(action: 'check' | 'request') {
  const { data, error } = await withTimeout(supabase.functions.invoke('staff-device-access', {
    body: { action, ...(action === 'request' ? { label: `${navigator.platform || 'Computer'} · ${/Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : 'Browser'}` } : {}) },
  }), 12000, 'Device approval');
  if (error || data?.error) {
    let message = data?.error;
    if (!message && error?.context instanceof Response) {
      try { message = (await error.context.clone().json())?.error; } catch { /* use generic error */ }
    }
    throw new Error(message || 'Unable to verify device approval. Please retry.');
  }
  return data;
}

export async function staffDeviceSignIn(email: string, password: string) {
  const { data, error } = await withTimeout(supabase.functions.invoke('staff-device-access', {
    body: { action: 'signin', email: email.trim().toLowerCase(), password, label: `${navigator.platform || 'Computer'} · ${/Chrome\//.test(navigator.userAgent) ? 'Chrome' : 'Browser'}` },
  }), 20000, 'Staff sign-in');
  if (error || data?.error) {
    let message = data?.error;
    if (!message && error?.context instanceof Response) {
      try { message = (await error.context.clone().json())?.error; } catch { /* generic message */ }
    }
    throw new Error(message || 'Staff sign-in unavailable. Please retry.');
  }
  if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Staff sign-in did not complete.');
  return supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}