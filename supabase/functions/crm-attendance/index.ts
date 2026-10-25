import { corsHeaders, requireAdmin } from '../_shared/admin-auth.ts';
import { z } from 'https://esm.sh/zod@3.25.76';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('record'), sessionId: z.string().uuid(), kind: z.enum(['open', 'activity', 'ping', 'hidden', 'left_crm', 'logout']), tab: z.string().max(80).nullable().optional() }).strict(),
  z.object({ action: z.literal('report'), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
]);
const staffRoles = ['admin', 'super_admin', 'sales_manager', 'performance_manager', 'sales_lead', 'sales', 'lead_gen', 'accounts', 'accounts_manager', 'accounts_payroll', 'claims_agent', 'claims_manager', 'blog_writer', 'dev_tester', 'member', 'viewer', 'guest', 'trader'];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const auth = await requireAdmin(req, { allowedRoles: staffRoles });
    if (!auth.ok) return auth.response;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid attendance request' }, 400);
    const request = parsed.data;
    if (request.action === 'report') {
      const { data, error } = await auth.supabase.rpc('get_crm_attendance', { p_user_id: auth.user.id, p_from: request.from, p_to: request.to });
      return error ? json({ error: 'Attendance report unavailable' }, error.code === '42501' ? 403 : 400) : json(data);
    }
    const { error } = await auth.supabase.rpc('record_crm_attendance', { p_user_id: auth.user.id, p_session_id: request.sessionId, p_kind: request.kind, p_current_tab: request.tab ?? null });
    return error ? json({ error: 'Attendance could not be recorded' }, error.code === '42501' ? 403 : 400) : json({ recorded: true });
  } catch { return json({ error: 'Attendance temporarily unavailable' }, 503); }
});