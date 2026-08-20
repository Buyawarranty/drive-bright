// Server-side fallback for admin dashboard telemetry.
//
// The dashboard normally inserts admin_ui_events straight from the browser.
// When that insert is rejected (RLS, missing/inactive admin_users row, expired
// token) the crash or slow-load evidence is lost — exactly the cases we most
// need for sales accounts. This function accepts the same rows and writes them
// with the service role so nothing is dropped.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ALLOWED_TYPES = new Set([
  'page_load',
  'tab_view',
  'cta_click',
  'crash',
  'js_error',
  'slow_load',
]);

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Identify the caller from their JWT (never trust ids from the body).
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    const body = await req.json().catch(() => null);
    const incoming = Array.isArray(body?.events) ? body.events : [];
    if (incoming.length === 0) return json({ error: 'No events supplied' }, 400);

    const rows = incoming
      .slice(0, 50)
      .filter((e: any) => ALLOWED_TYPES.has(e?.event_type))
      .map((e: any) => ({
        event_type: e.event_type,
        tab: str(e.tab, 100),
        path: str(e.path, 400),
        label: str(e.label, 200),
        detail: e.detail && typeof e.detail === 'object' ? e.detail : null,
        duration_ms: Number.isFinite(e.duration_ms) ? Math.round(e.duration_ms) : null,
        session_id: str(e.session_id, 100),
        user_agent: str(e.user_agent, 400),
        admin_user_id: adminRow?.id ?? null,
        admin_email: adminRow?.email ?? user.email ?? null,
      }));

    if (rows.length === 0) return json({ error: 'No valid events' }, 400);

    const { error } = await supabase.from('admin_ui_events').insert(rows);
    if (error) return json({ error: error.message }, 500);

    return json({ inserted: rows.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
