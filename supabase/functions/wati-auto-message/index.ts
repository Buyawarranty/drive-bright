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

const MAX_ATTEMPTS = 4;

/**
 * Sends the first WhatsApp message to brand new CRM leads through WATI.
 *
 * Triggered straight after a lead is created (and hourly as a retry backstop).
 * Every send is stored as an outbound message on the lead's WhatsApp
 * conversation so agents see the thread and delivery status in WhatsApp Leads.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: settings } = await supabase
    .from('whatsapp_auto_message_settings')
    .select('is_enabled, template_name, template_language')
    .limit(1)
    .maybeSingle();

  // Imported batches are sent even when automatic messaging for new website
  // leads is switched off, because someone asked for them by hand.
  const autoOn = settings?.is_enabled === true;

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) return json({ error: 'wati_not_configured' }, 503);
  const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  let query = supabase
    .from('whatsapp_auto_message_queue')
    .select('id, lead_id, phone_normalized, display_name, attempts, template_name, force_send')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString());

  if (!autoOn) query = query.eq('force_send', true);

  const { data: queued, error: queueErr } = await query
    .order('created_at', { ascending: true })
    .limit(20);

  if (queueErr) return json({ error: 'queue_read_failed', details: queueErr.message }, 500);
  if (!queued?.length) return json({ ok: true, processed: 0 });

  let sent = 0;
  let failed = 0;

  for (const row of queued) {
    const phone = row.phone_normalized;
    const localPhone = phone.startsWith('44') ? `0${phone.slice(2)}` : phone;
    const firstName = (row.display_name || '').split(/\s+/)[0] || 'there';
    const rowTemplate = (row.template_name || settings?.template_name || '').trim();
    if (!rowTemplate) {
      failed += 1;
      continue;
    }

    try {
      // ---- find or create the conversation so the thread is visible in the CRM
      let conversationId: string | null = null;
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id, opted_out_at')
        .eq('phone_normalized', phone)
        .maybeSingle();

      // Never message someone who replied STOP.
      if (existing?.opted_out_at) {
        await supabase
          .from('whatsapp_auto_message_queue')
          .update({ status: 'skipped', last_error: 'Customer opted out of WhatsApp messages' })
          .eq('id', row.id);
        continue;
      }

      if (existing?.id) {
        conversationId = existing.id;
      } else {
        const { data: created, error: convErr } = await supabase
          .from('whatsapp_conversations')
          .insert({
            wati_contact_id: phone,
            phone: localPhone,
            phone_normalized: phone,
            display_name: row.display_name,
            lead_id: row.lead_id,
            heat: 'normal',
            unread_count: 0,
            lead_source: 'crm_auto',
            is_open: true,
          })
          .select('id')
          .single();
        if (convErr) throw new Error(`conversation: ${convErr.message}`);
        conversationId = created.id;
      }

      // ---- send the approved template through WATI ------------------------
      const url =
        `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(phone)}`;
      const watiRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: rowTemplate,
          broadcast_name: `crm_new_lead_${new Date().toISOString().slice(0, 10)}`,
          parameters: [{ name: 'name', value: firstName }],
        }),
      });
      const text = await watiRes.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }

      if (!watiRes.ok || body?.result === false || body?.ok === false) {
        throw new Error(`wati ${watiRes.status}: ${text.slice(0, 400)}`);
      }

      const now = new Date().toISOString();
      const watiMessageId = String(
        body?.message?.whatsappMessageId || body?.message?.id || `auto-${row.id}`,
      );
      const preview = `Automatic WhatsApp message sent (${rowTemplate})`;

      await supabase.from('whatsapp_messages').upsert(
        {
          conversation_id: conversationId,
          wati_message_id: watiMessageId,
          direction: 'outbound',
          body: preview,
          status: 'sent',
          wati_timestamp: now,
          raw: body,
        },
        { onConflict: 'wati_message_id' },
      );

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message_at: now,
          last_message_preview: preview,
          last_direction: 'outbound',
          lead_id: row.lead_id,
          is_open: true,
        })
        .eq('id', conversationId);

      await supabase
        .from('sales_leads')
        .update({ whatsapp_conversation_id: conversationId })
        .eq('id', row.lead_id);

      await supabase
        .from('whatsapp_auto_message_queue')
        .update({
          status: 'sent',
          sent_at: now,
          conversation_id: conversationId,
          attempts: (row.attempts || 0) + 1,
          last_error: null,
        })
        .eq('id', row.id);

      sent += 1;
    } catch (error: any) {
      const attempts = (row.attempts || 0) + 1;
      const message = String(error?.message || error).slice(0, 500);
      console.error(`auto WhatsApp send failed for lead ${row.lead_id}: ${message}`);
      await supabase
        .from('whatsapp_auto_message_queue')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempts,
          last_error: message,
          next_attempt_at: new Date(Date.now() + attempts * 15 * 60 * 1000).toISOString(),
        })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return json({ ok: true, processed: queued.length, sent, failed });
});
