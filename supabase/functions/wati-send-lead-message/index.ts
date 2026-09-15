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

/** Turns a UK mobile into WATI's 44... form, or null when it is not a UK mobile. */
const normaliseMobile = (raw: string): string | null => {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  if (!/^07\d{9}$/.test(digits)) return null;
  return `44${digits.slice(1)}`;
};

const BLOCKED_STATUSES = ['do_not_contact', 'unsubscribed', 'fake_lead'];

/**
 * One-lead WhatsApp send for sales agents, on the same WATI channel as the
 * WhatsApp section of the CRM. The agent's edited wording goes out as a normal
 * chat message; when WhatsApp's 24-hour window is closed we fall back to the
 * chosen approved template so the customer still hears from us.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

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

  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminUser?.id || adminUser.is_active === false) return json({ error: 'forbidden' }, 403);

  let payload: { leadId?: string; templateName?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const leadId = String(payload.leadId || '').trim();
  const templateName = String(payload.templateName || '').trim();
  const message = String(payload.message || '').trim();
  if (!leadId) return json({ error: 'lead_required' }, 400);
  if (!message) return json({ error: 'message_required' }, 400);
  if (message.length > 4000) return json({ error: 'message_too_long' }, 400);

  const { data: lead } = await admin
    .from('sales_leads')
    .select('id, first_name, last_name, phone, status, assigned_to')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return json({ error: 'lead_not_found' }, 404);
  if (BLOCKED_STATUSES.includes(String(lead.status))) {
    return json({ error: 'blocked_status', details: 'This lead is marked do not contact.' }, 403);
  }

  const phone = normaliseMobile(lead.phone || '');
  if (!phone) return json({ error: 'no_uk_mobile' }, 400);

  const displayName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || null;

  // Find or create the conversation so this message lands in the WhatsApp section too.
  let { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id, opted_out_at, assigned_to, last_message_at, first_response_seconds')
    .eq('phone_normalized', phone)
    .maybeSingle();

  if (!conv) {
    const { data: created, error: createErr } = await admin
      .from('whatsapp_conversations')
      .insert({
        phone: lead.phone,
        phone_normalized: phone,
        display_name: displayName,
        lead_id: lead.id,
        assigned_to: lead.assigned_to || adminUser.id,
        lead_source: 'crm_new_leads',
        pipeline_status: 'contacted',
      })
      .select('id, opted_out_at, assigned_to, last_message_at, first_response_seconds')
      .maybeSingle();
    if (createErr || !created)
      return json({ error: 'conversation_create_failed', details: createErr?.message }, 500);
    conv = created;
  }

  if (conv.opted_out_at) {
    return json(
      { error: 'opted_out', details: 'This customer asked to stop receiving WhatsApp messages.' },
      403,
    );
  }

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) {
    return json(
      { error: 'wati_not_configured', details: 'WhatsApp sending is not switched on yet.' },
      503,
    );
  }
  const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  const url = `${endpoint}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(message)}`;
  let sessionOk = false;
  let watiBody: any = null;
  try {
    const watiRes = await fetch(url, { method: 'POST', headers: { Authorization: auth } });
    const watiText = await watiRes.text();
    try {
      watiBody = JSON.parse(watiText);
    } catch {
      watiBody = { raw: watiText };
    }
    sessionOk = watiRes.ok && watiBody?.ok !== false && watiBody?.result !== false;
    if (!sessionOk) console.error(`WATI session send failed [${watiRes.status}]: ${watiText}`);
  } catch (error) {
    console.error('WATI unreachable', error);
  }

  const now = new Date().toISOString();

  if (sessionOk) {
    const watiMessageId =
      watiBody?.message?.whatsappMessageId ||
      watiBody?.message?.id ||
      `out-${conv.id}-${Date.now()}`;

    await admin.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      wati_message_id: String(watiMessageId),
      direction: 'outbound',
      body: message,
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
        lead_id: lead.id,
        display_name: displayName,
        first_response_seconds: firstResponse,
      })
      .eq('id', conv.id);

    return json({ ok: true, mode: 'chat', conversationId: conv.id });
  }

  // Outside the 24-hour window WhatsApp only allows approved templates.
  if (!templateName) {
    return json(
      {
        error: 'template_required',
        details:
          'This customer has not messaged in the last 24 hours, so an approved template must be chosen.',
      },
      409,
    );
  }

  const { error: queueErr } = await admin.from('whatsapp_auto_message_queue').insert({
    lead_id: lead.id,
    phone_normalized: phone,
    display_name: displayName,
    template_name: templateName,
    force_send: true,
    batch_label: `Agent send ${now.slice(0, 16).replace('T', ' ')}`,
    status: 'pending',
  });
  if (queueErr) return json({ error: 'queue_failed', details: queueErr.message }, 500);

  try {
    await admin.functions.invoke('wati-auto-message', { body: { trigger: 'agent_send' } });
  } catch (error) {
    console.error('auto-message invoke failed', error);
  }

  return json({ ok: true, mode: 'template', templateName, conversationId: conv.id });
});
