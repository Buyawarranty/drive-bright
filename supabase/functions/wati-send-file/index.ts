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

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mpeg',
  'audio/ogg',
  'video/mp4',
];

/** Sends an image, PDF, audio clip or video to a WhatsApp conversation via WATI. */
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'invalid_form_data' }, 400);
  }

  const conversationId = String(form.get('conversationId') || '').trim();
  const caption = String(form.get('caption') || '').trim().slice(0, 900);
  const file = form.get('file');
  if (!conversationId || !(file instanceof File)) return json({ error: 'conversation_and_file_required' }, 400);
  if (file.size === 0) return json({ error: 'file_empty' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'file_too_large' }, 400);
  if (file.type && !ALLOWED.includes(file.type)) return json({ error: 'file_type_not_allowed' }, 400);

  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminUser?.id || adminUser.is_active === false) return json({ error: 'forbidden' }, 403);

  const { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id, phone_normalized, assigned_to, opted_out_at, last_message_at, first_response_seconds')
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
  if (conv.assigned_to !== adminUser.id && canManage !== true) return json({ error: 'not_your_lead' }, 403);

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) {
    return json({ error: 'wati_not_configured', details: 'WhatsApp sending is not switched on yet.' }, 503);
  }

  const outbound = new FormData();
  outbound.append('file', file, file.name || 'attachment');

  const url =
    `${endpoint}/api/v1/sendSessionFile/${conv.phone_normalized}` +
    (caption ? `?caption=${encodeURIComponent(caption)}` : '');
  const watiRes = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
    body: outbound,
  });
  const watiText = await watiRes.text();
  let watiBody: any = null;
  try {
    watiBody = JSON.parse(watiText);
  } catch {
    watiBody = { raw: watiText };
  }
  if (!watiRes.ok || watiBody?.ok === false || watiBody?.result === false) {
    console.error(`WATI file send failed [${watiRes.status}]: ${watiText}`);
    return json(
      { error: 'wati_send_failed', status: watiRes.status, details: watiBody },
      watiRes.status === 200 ? 502 : watiRes.status,
    );
  }

  // Keep a copy in storage so the thread can show the attachment.
  let publicUrl: string | null = null;
  const safeName = (file.name || 'attachment').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `whatsapp/${conversationId}/${Date.now()}_${safeName}`;
  const upload = await admin.storage
    .from('whatsapp-attachments')
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upload.error) {
    console.error('attachment upload failed:', upload.error.message);
  } else {
    const signed = await admin.storage
      .from('whatsapp-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    publicUrl = signed.data?.signedUrl ?? null;
  }

  const now = new Date().toISOString();
  const watiMessageId =
    watiBody?.message?.whatsappMessageId || watiBody?.message?.id || `file-${conversationId}-${Date.now()}`;
  const preview = caption || `Sent ${file.name || 'an attachment'}`;

  await admin.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wati_message_id: String(watiMessageId),
    direction: 'outbound',
    body: preview,
    status: 'sent',
    sent_by_admin_id: adminUser.id,
    wati_timestamp: now,
    media_url: publicUrl,
    media_type: file.type || null,
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
      last_message_preview: preview.slice(0, 180),
      last_direction: 'outbound',
      last_agent_reply_at: now,
      unread_count: 0,
      first_response_seconds: firstResponse,
    })
    .eq('id', conversationId);

  return json({ ok: true, wati_message_id: String(watiMessageId), media_url: publicUrl });
});
