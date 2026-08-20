import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { verifyPassword, PASSWORD_NOT_VERIFIED_MESSAGE } from "../_shared/verify-password.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sections the shared backup login must NEVER be able to open.
const BLOCKED_TABS = ['analytics', 'lead-teams', 'open-round-robin', 'orr-test-lab', 'vehicle-stats'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const tabIds: string[] = Array.isArray(body.tabIds) ? body.tabIds : [];

    if (!email || password.length < 8) {
      return new Response(JSON.stringify({ error: 'A valid email and a password of at least 8 characters are required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Caller must be an active super admin
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token ?? '');
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: caller } = await supabase
      .from('admin_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!caller || caller.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: super admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build the permission map: everything the caller sent, minus the blocked sections.
    const permissions: Record<string, boolean> = {};
    for (const id of tabIds) {
      if (typeof id === 'string' && id) permissions[`tab_${id}`] = true;
    }
    permissions['tab_customers_see-source'] = true;
    permissions['tab_new-leads_see-source'] = true;
    permissions['tab_new-leads_lead-routing'] = false;
    permissions['tab_new-leads_live-tracking'] = true;
    for (const id of BLOCKED_TABS) permissions[`tab_${id}`] = false;

    // Create or update the auth user
    let userId: string;
    let created = false;
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Backup', last_name: 'Access', backup_login: true },
    });

    if (createErr) {
      if (!createErr.message.includes('already been registered')) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        return new Response(JSON.stringify({ error: 'Could not look up the existing backup user.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const existing = list.users.find(u => u.email?.toLowerCase() === email);
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Backup user exists but could not be found.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      userId = newUser!.user!.id;
      created = true;
    }

    // Admin profile: 'admin' role gives near-super-admin reach, while the explicit
    // false flags above hard-block the restricted sections.
    const { error: adminErr } = await supabase.from('admin_users').upsert({
      user_id: userId,
      email,
      first_name: 'Backup',
      last_name: 'Access',
      role: 'admin',
      permissions,
      is_active: true,
    }, { onConflict: 'user_id' });
    if (adminErr) {
      return new Response(JSON.stringify({ error: adminErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });

    const verified = await verifyPassword(email, password);
    if (!verified) {
      return new Response(JSON.stringify({ error: PASSWORD_NOT_VERIFIED_MESSAGE }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      created,
      email,
      blocked: BLOCKED_TABS,
      granted: Object.keys(permissions).filter(k => permissions[k]).length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('provision-backup-login error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
