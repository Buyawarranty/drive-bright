import { corsHeaders, requireAdmin } from '../_shared/admin-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const auth = await requireAdmin(req, { allowedRoles: ['admin', 'super_admin', 'accounts', 'accounts_manager', 'accounts_payroll'] });
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.supabase.rpc('get_paylater_claim_customer_ids_for_staff', { p_user_id: auth.user.id });
    if (error) return json({ error: 'Unable to load PayLater claims' }, error.code === '42501' ? 403 : 503);
    return json({ customer_ids: data });
  } catch {
    return json({ error: 'Unable to load PayLater claims' }, 503);
  }
});