import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Never open these to a temporary login.
const BLOCKED_TABS = ['analytics', 'lead-teams', 'open-round-robin', 'orr-test-lab', 'vehicle-stats'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const firstName = String(body.firstName || 'Temp').trim() || 'Temp';
    const lastName = String(body.lastName || 'Developer').trim() || 'Developer';
    const days = Math.min(Math.max(Number(body.days) || 2, 1), 14);
    const role = ['admin', 'dev_tester'].includes(String(body.role)) ? String(body.role) : 'admin';
    const tabIds: string[] = Array.isArray(body.tabIds) ? body.tabIds : [];

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email-shaped username (a fake domain like @baw.dev is fine).' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    // Caller must be an active super admin
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token ?? '');
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);
    const { data: caller } = await supabase
      .from('admin_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!caller || caller.role !== 'super_admin') return json({ error: 'Forbidden: super admin only' }, 403);

    const permissions: Record<string, boolean> = {};
    for (const id of tabIds) if (typeof id === 'string' && id) permissions[`tab_${id}`] = true;
    for (const id of BLOCKED_TABS) permissions[`tab_${id}`] = false;

    // Create or reuse the auth login
    let userId: string;
    let created = false;
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, temp_access: true },
    });

    if (createErr) {
      if (!createErr.message.includes('already been registered')) return json({ error: createErr.message }, 400);
      let existingId: string | null = null;
      for (let page = 1; page <= 20 && !existingId; page++) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) return json({ error: 'Could not look up the existing login.' }, 400);
        const match = list?.users?.find((u: any) => (u.email || '').toLowerCase() === email);
        if (match) existingId = match.id;
        if (!list?.users || list.users.length < 200) break;
      }
      if (!existingId) return json({ error: 'That login exists but could not be found.' }, 400);
      userId = existingId;
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updErr) return json({ error: updErr.message }, 400);
    } else {
      userId = newUser!.user!.id;
      created = true;
    }

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error: adminErr } = await supabase.from('admin_users').upsert({
      user_id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      permissions,
      is_active: true,
      is_temp_access: true,
      access_expires_at: expiresAt,
    }, { onConflict: 'user_id' });
    if (adminErr) return json({ error: adminErr.message }, 400);

    await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });

    // Prove the password works before it is shared.
    let verified = false;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      verified = res.ok;
    } catch (_e) {
      verified = false;
    }
    if (!verified) return json({ error: 'The login was saved but could not be verified — do not share it yet.' }, 400);

    return json({ success: true, created, email, role, expiresAt, verified });
  } catch (e) {
    console.error('provision-temp-login error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
