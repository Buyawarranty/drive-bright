import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { highestHeat, normaliseUkPhone, scoreWhatsAppMessage, type WhatsAppHeat } from '../_shared/whatsappHeat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wati-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * WATI inbound webhook.
 *
 * Handles both new customer messages and message-status callbacks. The CRM owns
 * lead ownership, so this function never assigns an agent: it only creates or
 * updates the conversation, stores the message and scores buying intent.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = Deno.env.get('WATI_WEBHOOK_SECRET');
  if (expected) {
    const url = new URL(req.url);
    const provided = req.headers.get('x-wati-secret') || url.searchParams.get('secret');
    if (provided !== expected) return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  try {
    const eventType = String(payload.eventType || payload.type || '').toLowerCase();

    // ---- message status callback (sent / delivered / read / failed) ----------
    const statusValue = String(payload.status || payload.eventType || '').toLowerCase();
    const statusId = payload.whatsappMessageId || payload.id || payload.messageId;
    if (
      statusId &&
      !payload.text &&
      ['sent', 'delivered', 'read', 'failed'].some((s) => statusValue.includes(s))
    ) {
      const mapped = ['read', 'delivered', 'failed', 'sent'].find((s) => statusValue.includes(s)) || 'sent';
      await supabase
        .from('whatsapp_messages')
        .update({ status: mapped })
        .eq('wati_message_id', String(statusId));
      return json({ ok: true, updated: 'status' });
    }

    // ---- inbound customer message -----------------------------------------
    const rawPhone = String(payload.waId || payload.whatsappNumber || payload.phone || '').trim();
    if (!rawPhone) return json({ ok: true, ignored: 'no_phone', eventType });

    const phoneNormalized = normaliseUkPhone(rawPhone);
    if (phoneNormalized.length < 9) return json({ ok: true, ignored: 'bad_phone' });
    const tail9 = phoneNormalized.slice(-9);
    const localPhone = phoneNormalized.startsWith('44') ? `0${phoneNormalized.slice(2)}` : phoneNormalized;

    const body: string = String(payload.text ?? payload.message ?? '').trim();
    const mediaUrl: string | null = payload.data?.url || payload.mediaUrl || null;
    const mediaType: string | null = payload.type && payload.type !== 'text' ? String(payload.type) : null;
    const watiMessageId = String(payload.id || payload.whatsappMessageId || `${phoneNormalized}-${Date.now()}`);
    const displayName = String(payload.senderName || payload.name || '').trim() || null;
    const watiTimestamp = payload.timestamp
      ? new Date(Number.isNaN(Number(payload.timestamp)) ? payload.timestamp : Number(payload.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    // Existing conversation?
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_normalized', phoneNormalized)
      .maybeSingle();

    const repliedToAgent = existing?.last_direction === 'outbound';
    const scored = scoreWhatsAppMessage(body, { repliedToAgent });
    const preview = body ? body.slice(0, 180) : mediaType ? `[${mediaType}]` : '';

    let conversationId = existing?.id as string | undefined;
    let isNewConversation = false;
    let becameHot = false;

    if (existing) {
      const nextHeat: WhatsAppHeat = existing.is_open
        ? highestHeat((existing.heat || 'normal') as WhatsAppHeat, scored.heat)
        : scored.heat;
      becameHot = nextHeat === 'hot' && existing.heat !== 'hot';

      await supabase
        .from('whatsapp_conversations')
        .update({
          display_name: displayName || existing.display_name,
          wati_contact_id: payload.waId ? String(payload.waId) : existing.wati_contact_id,
          heat: nextHeat,
          heat_reason: scored.reason || existing.heat_reason,
          unread_count: (existing.unread_count || 0) + 1,
          last_message_at: watiTimestamp,
          last_message_preview: preview,
          last_direction: 'inbound',
          is_open: true,
        })
        .eq('id', existing.id);
    } else {
      isNewConversation = true;
      becameHot = scored.heat === 'hot';

      // Link to an existing lead / customer so we never create a duplicate.
      const { data: leadMatch } = await supabase.rpc('find_sales_lead_by_phone_tail9', { tail_digits: tail9 });
      const leadId: string | null = Array.isArray(leadMatch) && leadMatch[0]?.id ? leadMatch[0].id : null;

      const { data: inserted, error: insertErr } = await supabase
        .from('whatsapp_conversations')
        .insert({
          wati_contact_id: String(payload.waId || rawPhone),
          phone: localPhone,
          phone_normalized: phoneNormalized,
          display_name: displayName,
          lead_id: leadId,
          heat: scored.heat,
          heat_reason: scored.reason,
          unread_count: 1,
          last_message_at: watiTimestamp,
          last_message_preview: preview,
          last_direction: 'inbound',
          lead_source: 'whatsapp',
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('conversation insert failed:', insertErr.message);
        return json({ error: 'conversation_insert_failed', details: insertErr.message }, 500);
      }
      conversationId = inserted.id;

      // Create the lead if this number is brand new to the CRM.
      let finalLeadId = leadId;
      if (!finalLeadId) {
        const nameParts = (displayName || '').split(/\s+/);
        const { data: newLead, error: leadErr } = await supabase
          .from('sales_leads')
          .insert({
            first_name: nameParts[0] || 'WhatsApp',
            last_name: nameParts.slice(1).join(' ') || 'enquiry',
            email: `whatsapp_${tail9}@nomail.temp`,
            phone: localPhone,
            lead_source: 'other',
            status: 'new',
            notes: `WhatsApp enquiry: ${preview}`,
            whatsapp_conversation_id: conversationId,
          })
          .select('id')
          .single();
        if (leadErr) console.error('lead insert failed:', leadErr.message);
        else finalLeadId = newLead.id;
      }

      if (finalLeadId) {
        await supabase.from('whatsapp_conversations').update({ lead_id: finalLeadId }).eq('id', conversationId);
        await supabase
          .from('sales_leads')
          .update({ whatsapp_conversation_id: conversationId })
          .eq('id', finalLeadId);

        // Tag the lead so it is obvious where it came from.
        let tagId: string | null = null;
        const { data: tag } = await supabase.from('lead_tags').select('id').eq('name', 'WhatsApp').maybeSingle();
        if (tag?.id) tagId = tag.id;
        else {
          const { data: created } = await supabase
            .from('lead_tags')
            .insert({ name: 'WhatsApp', color: '#25D366' })
            .select('id')
            .maybeSingle();
          tagId = created?.id ?? null;
        }
        if (tagId) {
          await supabase
            .from('lead_tag_assignments')
            .upsert({ lead_id: finalLeadId, tag_id: tagId }, { onConflict: 'lead_id,tag_id' });
        }
      }
    }

    if (!conversationId) return json({ error: 'no_conversation' }, 500);

    const { error: msgErr } = await supabase.from('whatsapp_messages').upsert(
      {
        conversation_id: conversationId,
        wati_message_id: watiMessageId,
        direction: 'inbound',
        body: body || null,
        media_url: mediaUrl,
        media_type: mediaType,
        status: 'delivered',
        wati_timestamp: watiTimestamp,
        raw: payload,
      },
      { onConflict: 'wati_message_id' },
    );
    if (msgErr) console.error('message insert failed:', msgErr.message);

    return json({
      ok: true,
      conversation_id: conversationId,
      heat: scored.heat,
      new_conversation: isNewConversation,
      became_hot: becameHot,
    });
  } catch (error: any) {
    console.error('wati-webhook error:', error?.message || error);
    return json({ error: 'unexpected_error', details: String(error?.message || error) }, 500);
  }
});
