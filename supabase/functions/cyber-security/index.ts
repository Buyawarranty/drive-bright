import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireAdmin } from '../_shared/admin-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const auth = await requireAdmin(req, { allowedRoles: ['admin', 'super_admin'] });
    if (!auth.ok) return auth.response;
    const body = await req.json();
    if (body?.action !== 'check' || Object.keys(body).length !== 1) return json({ error: 'Invalid request' }, 400);
    const { data, error } = await auth.supabase.rpc('get_cyber_security_status', { p_user_id: auth.user.id });
    if (error) return json({ error: 'Protection check unavailable or access denied' }, 403);
    const website = await Promise.all(['/', '/auth', '/sales-login', '/dealer-portal/login'].map(async path => {
      try {
        const response = await fetch(`https://buyawarranty.co.uk${path}`, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
        return { path, reachable: response.ok, https: response.url.startsWith('https://'), hsts: !!response.headers.get('strict-transport-security'), csp: !!response.headers.get('content-security-policy'), framing: !!response.headers.get('x-frame-options') || /frame-ancestors/i.test(response.headers.get('content-security-policy') ?? ''), nosniff: response.headers.get('x-content-type-options') === 'nosniff' };
      } catch { return { path, reachable: false }; }
    }));
    return json({ ...data, website });
  } catch { return json({ error: 'Unable to check protections. Try again.' }, 503); }
});