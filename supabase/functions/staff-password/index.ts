import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.25.76';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('change'), currentPassword: z.string().min(1).max(128), password: z.string().min(12).max(128) }).strict(),
]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const bearer = req.headers.get('Authorization');
    if (!bearer?.startsWith('Bearer ')) return json({ error: 'Sign in first' }, 401);
    const { data: { user }, error } = await service.auth.getUser(bearer.slice(7));
    if (error || !user) return json({ error: 'Sign in first' }, 401);
    const { data: staff, error: staffError } = await service.from('admin_users').select('is_active,archived_at,access_expires_at').eq('user_id', user.id).maybeSingle();
    if (staffError) return json({ error: 'Unable to check staff access' }, 503);
    if (!staff) return json({ is_staff: false });
    if (!staff.is_active || staff.archived_at || (staff.access_expires_at && Date.parse(staff.access_expires_at) <= Date.now())) return json({ error: 'Staff account is inactive' }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid password request; new passwords need 12–128 characters' }, 400);
    if (parsed.data.action === 'change') {
      if (parsed.data.currentPassword === parsed.data.password) return json({ error: 'Choose a different personal password' }, 400);
      const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false } });
      const verified = await anon.auth.signInWithPassword({ email: user.email ?? '', password: parsed.data.currentPassword });
      if (verified.error || verified.data.user?.id !== user.id) return json({ error: 'Current password is incorrect' }, 400);
      await anon.auth.signOut({ scope: 'local' });
      const { error: updateError } = await service.auth.admin.updateUserById(user.id, { password: parsed.data.password });
      if (updateError) return json({ error: updateError.message }, 400);
      const { error: recordError } = await service.rpc('staff_password_record_change', { p_user_id: user.id });
      if (recordError) return json({ error: 'Password changed, but renewal date could not be saved. Contact your admin.' }, 503);
    }
    const { data, error: statusError } = await service.rpc('staff_password_status', { p_user_id: user.id });
    return statusError ? json({ error: 'Unable to check password renewal' }, 503) : json(data);
  } catch { return json({ error: 'Unable to process password request' }, 503); }
});