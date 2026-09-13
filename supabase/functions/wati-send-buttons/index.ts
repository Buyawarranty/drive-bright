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

/** Sends a WhatsApp message with tappable reply buttons through WATI. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (claimsErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  let payload: { conversationId?: string; message?: string; buttons?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const conversationId = String(payload.conversationId || '').trim();
  const message = String(payload.message || '').trim();
  const buttons = Array.isArray(payload.buttons)
    ? payload.buttons.map((b) => String(b || '').trim()).filter(Boolean).slice(0, 3)
    : [];

  if (!conversationId || !message) return json({ error: 'conversation_and_message_required' }, 400);
  if (message.length > 1024) return json({ error: 'message_too_long' }, 400);
  if (buttons.length === 0) return json({ error: 'buttons_required' }, 400);
  if (buttons.some((b) => b.length > 20)) return json({ error: 'button_text_too_long' }, 400);

  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminUser?.id || adminUser.is_active === false) return json({ error: 'forbidden' }, 403);

  const { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id, phone_normalized, assigned_to, opted_out_at, last_message_at, last_agent_reply_at, first_response_seconds')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return json({ error: 'conversation_not_found' }, 404);
  if (conv.opted_out_at) {
    return json(
      { error: 'opted_out', details: 'This customer asked to stop receiving WhatsApp messages.' },
      403,
    );
  }

  const { data: canManage } = await admin.rpc('can_manage_lead_routing', { _user_id: userId });
  if (conv.assigned_to !== adminUser.id && canManage !== true) {
    return json({ error: 'not_your_lead' }, 403);
  }

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) {
    return json({ error: 'wati_not_configured', details: 'WhatsApp sending is not switched on yet.' }, 503);
  }

  const url = `${endpoint}/api/v1/sendInteractiveButtonsMessage?whatsappNumber=${conv.phone_normalized}`;
  const watiRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: { text: message },
      buttons: buttons.map((text) => ({ text })),
    }),
  });
  const watiText = await watiRes.text();
  let watiBody: any = null;
  try {
    watiBody = JSON.parse(watiText);
  } catch {
    watiBody = { raw: watiText };
  }

  if (!watiRes.ok || watiBody?.ok === false || watiBody?.result === false) {
    console.error(`WATI buttons send failed [${watiRes.status}]: ${watiText}`);
    return json(
      { error: 'wati_send_failed', status: watiRes.status, details: watiBody },
      watiRes.status === 200 ? 502 : watiRes.status,
    );
  }

  const now = new Date().toISOString();
  const watiMessageId =
    watiBody?.message?.whatsappMessageId || watiBody?.message?.id || `btn-${conversationId}-${Date.now()}`;
  const storedBody = `${message}\n\n[Buttons: ${buttons.join(' | ')}]`;

  await admin.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wati_message_id: String(watiMessageId),
    direction: 'outbound',
    body: storedBody,
    status: 'sent',
    sent_by_admin_id: adminUser.id,
    wati_timestamp: now,
    raw: watiBody,
  });

  const firstResponse =
    conv.first_response_seconds == null && conv.last_message_at
      ? Math.max(0, Math.round((Date.now() - new Date(conv.last_message_at).getTime()) / 1000))
      : conv.first_response_seconds;

  await admin
    .from('whatsapp_conversations')
    .update({
      last_message_at: now,
      last_message_preview: message.slice(0, 180),
      last_direction: 'outbound',
      last_agent_reply_at: now,
      unread_count: 0,
      first_response_seconds: firstResponse,
    })
    .eq('id', conversationId);

  return json({ ok: true, wati_message_id: String(watiMessageId) });
});
