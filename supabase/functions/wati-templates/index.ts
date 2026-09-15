import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Lists the approved WhatsApp templates from WATI so managers can pick one. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  // Any active staff member can read the template list so agents can pick one
  // when messaging a lead; sending is still checked separately.
  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminUser?.id || adminUser.is_active === false) return json({ error: 'forbidden' }, 403);

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) return json({ error: 'wati_not_configured' }, 503);
  const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  try {
    const res = await fetch(`${endpoint}/api/v1/getMessageTemplates?pageSize=200&pageNumber=1`, {
      headers: { Authorization: auth },
    });
    const text = await res.text();
    if (!res.ok) return json({ error: 'wati_error', details: text.slice(0, 300) }, 502);

    let body: any = {};
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'wati_bad_response' }, 502);
    }

    const list: any[] = body?.messageTemplates || body?.result || body?.data || [];
    const templates = list
      .map((t) => ({
        name: String(t.elementName || t.element_name || t.name || '').trim(),
        language: String(t.languageCode || t.language?.key || t.language || 'en_GB'),
        status: String(t.status || 'UNKNOWN').toUpperCase(),
        body: String(t.bodyOriginal || t.body || t.bodyText || '').slice(0, 400),
      }))
      .filter((t) => t.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return json({ ok: true, templates });
  } catch (error: any) {
    return json({ error: 'wati_unreachable', details: String(error?.message || error) }, 502);
  }
});
