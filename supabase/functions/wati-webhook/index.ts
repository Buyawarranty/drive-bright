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

    // ---- opt out / opt back in ---------------------------------------------
    let optOut: 'out' | 'in' | null = null;
    try {
      optOut = await handleOptOutKeywords(supabase, {
        conversationId,
        leadId: (existing?.lead_id as string | null) ?? null,
        body,
        alreadyOptedOut: Boolean(existing?.opted_out_at),
      });
    } catch (e: any) {
      console.error('opt-out handling failed:', e?.message || e);
    }

    // ---- out-of-hours automatic reply --------------------------------------
    let awayReplySent = false;
    if (optOut !== 'out' && !(existing?.opted_out_at && optOut !== 'in')) {
      try {
        awayReplySent = await maybeSendAwayReply(supabase, {
          conversationId,
          phoneNormalized,
          lastAwayReplyAt: existing?.last_away_reply_at ?? null,
        });
      } catch (e: any) {
        console.error('away reply failed:', e?.message || e);
      }
    }

    return json({
      away_reply_sent: awayReplySent,
      opt_out: optOut,
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

/** Minutes since midnight in UK time, plus the weekday (0 = Sunday). */
function ukNow(): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: Math.max(0, days.indexOf(get('weekday'))),
  };
}

const toMinutes = (t: string): number => {
  const [h, m] = String(t || '').split(':');
  return Number(h || 0) * 60 + Number(m || 0);
};

/**
 * Sends the out-of-hours reply when the office is closed and this customer has
 * not already had one in the last 12 hours. Returns true when a reply went out.
 */
async function maybeSendAwayReply(
  supabase: any,
  args: { conversationId: string; phoneNormalized: string; lastAwayReplyAt: string | null },
): Promise<boolean> {
  const { data: settings } = await supabase
    .from('whatsapp_auto_message_settings')
    .select('away_reply_enabled, away_reply_text, office_open_time, office_close_time, away_weekends_closed')
    .limit(1)
    .maybeSingle();

  const text = String(settings?.away_reply_text || '').trim();
  if (!settings?.away_reply_enabled || !text) return false;

  const { minutes, weekday } = ukNow();
  const open = toMinutes(settings.office_open_time || '09:00');
  const close = toMinutes(settings.office_close_time || '17:00');
  const weekendClosed = settings.away_weekends_closed !== false && (weekday === 0 || weekday === 6);
  const withinHours = minutes >= open && minutes < close;
  if (!weekendClosed && withinHours) return false;

  if (args.lastAwayReplyAt) {
    const hours = (Date.now() - new Date(args.lastAwayReplyAt).getTime()) / 3_600_000;
    if (hours < 12) return false;
  }

  const endpoint = (Deno.env.get('WATI_API_ENDPOINT') || '').replace(/\/+$/, '');
  const token = Deno.env.get('WATI_ACCESS_TOKEN');
  if (!endpoint || !token) return false;

  const url = `${endpoint}/api/v1/sendSessionMessage/${args.phoneNormalized}?messageText=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
  });
  const raw = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = { raw };
  }
  if (!res.ok || body?.ok === false || body?.result === false) {
    console.error(`away reply send failed [${res.status}]: ${raw}`);
    return false;
  }

  const now = new Date().toISOString();
  await supabase.from('whatsapp_messages').insert({
    conversation_id: args.conversationId,
    wati_message_id: String(body?.message?.whatsappMessageId || body?.message?.id || `away-${args.conversationId}-${Date.now()}`),
    direction: 'outbound',
    body: text,
    status: 'sent',
    wati_timestamp: now,
    raw: body,
  });

  await supabase
    .from('whatsapp_conversations')
    .update({
      last_away_reply_at: now,
      last_message_at: now,
      last_message_preview: text.slice(0, 180),
      last_direction: 'outbound',
    })
    .eq('id', args.conversationId);

  return true;
}

const OPT_OUT_WORDS = ['stop', 'unsubscribe', 'opt out', 'optout', 'remove me', 'do not contact', 'dont contact', "don't contact", 'no more messages', 'leave me alone'];
const OPT_IN_WORDS = ['start', 'unstop', 'subscribe', 'opt in', 'optin', 'resume'];

/**
 * Honours "STOP" style replies: the conversation is flagged, tagged and the
 * lead is marked unsubscribed so no further WhatsApp messages go out. "START"
 * puts them back on.
 */
async function handleOptOutKeywords(
  supabase: any,
  args: { conversationId: string; leadId: string | null; body: string; alreadyOptedOut: boolean },
): Promise<'out' | 'in' | null> {
  const text = (args.body || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return null;

  const matched = (list: string[]) => list.find((w) => text === w || text.startsWith(`${w} `) || text.endsWith(` ${w}`));
  const outWord = matched(OPT_OUT_WORDS);
  const inWord = outWord ? undefined : matched(OPT_IN_WORDS);
  if (!outWord && !inWord) return null;

  let leadId = args.leadId;
  if (!leadId) {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('lead_id')
      .eq('id', args.conversationId)
      .maybeSingle();
    leadId = conv?.lead_id ?? null;
  }

  // Make sure the tag exists so it shows on the conversation list.
  let tagId: string | null = null;
  const { data: tag } = await supabase
    .from('whatsapp_tags')
    .select('id')
    .eq('name', 'Opted out')
    .maybeSingle();
  if (tag?.id) tagId = tag.id;
  else {
    const { data: created } = await supabase
      .from('whatsapp_tags')
      .insert({ name: 'Opted out', color: '#DC2626', sort_order: 99 })
      .select('id')
      .maybeSingle();
    tagId = created?.id ?? null;
  }

  if (outWord) {
    await supabase
      .from('whatsapp_conversations')
      .update({ opted_out_at: new Date().toISOString(), opt_out_reason: args.body.slice(0, 180) })
      .eq('id', args.conversationId);

    if (tagId) {
      await supabase
        .from('whatsapp_conversation_tags')
        .upsert({ conversation_id: args.conversationId, tag_id: tagId }, { onConflict: 'conversation_id,tag_id' });
    }
    if (leadId) {
      await supabase.from('sales_leads').update({ status: 'unsubscribed' }).eq('id', leadId);
    }
    return 'out';
  }

  await supabase
    .from('whatsapp_conversations')
    .update({ opted_out_at: null, opt_out_reason: null })
    .eq('id', args.conversationId);
  if (tagId) {
    await supabase
      .from('whatsapp_conversation_tags')
      .delete()
      .eq('conversation_id', args.conversationId)
      .eq('tag_id', tagId);
  }
  return 'in';
}
