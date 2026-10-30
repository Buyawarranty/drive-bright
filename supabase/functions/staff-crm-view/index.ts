import { requireAdmin, corsHeaders } from '../_shared/admin-auth.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const auth = await requireAdmin(req, { allowedRoles: ['admin','super_admin','sales','sales_lead','sales_manager','performance_manager','accounts','accounts_manager','claims_agent','claims_manager','lead_gen','blog_writer','dev_tester','trader','member','viewer'] });
    if (!auth.ok) return auth.response;
    const body = await req.json();
    if (typeof body.tab !== 'string' || !/^[a-z0-9-]{1,60}$/.test(body.tab)) return json({ error: 'Invalid page' }, 400);
    const { error } = await auth.supabase.rpc('record_staff_crm_view', { _tab: body.tab, _filters: body.filters ?? {}, _user_id: auth.user.id });
    return error ? json({ error: 'Unable to record view' }, 503) : json({ recorded: true });
  } catch { return json({ error: 'Unable to record view' }, 503); }
});