// Zoiper / SIP PBX CDR webhook.
// Ingests one call detail record per POST and upserts into zoiper_call_events.
//
// Auth: shared secret in `x-zoiper-secret` header, matching env ZOIPER_WEBHOOK_SECRET.
// Body (JSON) — snake_case or camelCase accepted:
//   external_call_id / externalCallId
//   agent_extension  / agentExtension           (preferred agent match)
//   agent_email      / agentEmail               (fallback agent match)
//   direction        ("inbound" | "outbound")
//   status           ("answered" | "missed" | "busy" | "no_answer" | "failed" | "cancelled")
//   dialed_number    / dialedNumber
//   caller_number    / callerNumber
//   started_at       / startedAt                (ISO or unix seconds)
//   answered_at      / answeredAt
//   ended_at         / endedAt
//   duration_seconds / durationSeconds
//   talk_seconds     / talkSeconds

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-zoiper-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  }
  return null;
};

const toIso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Unix seconds or ms
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('ZOIPER_WEBHOOK_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'server_not_configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Accept the shared secret in either a header (preferred) OR a query-string
  // param, so PBXs like Dial 9 that don't expose custom-header config on the
  // webhook can still authenticate by pasting `?secret=...` onto the URL.
  const url = new URL(req.url);
  const providedHeader = req.headers.get('x-zoiper-secret') || '';
  const providedQuery = url.searchParams.get('secret') || url.searchParams.get('x-zoiper-secret') || '';
  const provided = providedHeader || providedQuery;
  if (provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const startedAt = toIso(pick(body, 'started_at', 'startedAt', 'start', 'call_start'));
  if (!startedAt) {
    return new Response(JSON.stringify({ error: 'started_at required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const record = {
    external_call_id:
      (pick(body, 'external_call_id', 'externalCallId', 'call_id', 'callId', 'id') as string) ||
      null,
    agent_email:
      ((pick(body, 'agent_email', 'agentEmail', 'user_email') as string) || '').toLowerCase() ||
      null,
    agent_extension:
      (pick(body, 'agent_extension', 'agentExtension', 'extension', 'ext') as string) || null,
    direction: ((pick(body, 'direction') as string) || 'outbound').toLowerCase(),
    status: ((pick(body, 'status', 'disposition') as string) || 'answered').toLowerCase(),
    dialed_number: (pick(body, 'dialed_number', 'dialedNumber', 'to', 'destination') as string) || null,
    caller_number: (pick(body, 'caller_number', 'callerNumber', 'from', 'source') as string) || null,
    started_at: startedAt,
    answered_at: toIso(pick(body, 'answered_at', 'answeredAt', 'answer')),
    ended_at: toIso(pick(body, 'ended_at', 'endedAt', 'end', 'call_end')),
    duration_seconds: toInt(pick(body, 'duration_seconds', 'durationSeconds', 'duration')),
    talk_seconds: toInt(pick(body, 'talk_seconds', 'talkSeconds', 'billsec', 'talk_time')),
    raw_payload: body,
    agent_user_id: null as string | null,
  };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Resolve agent_user_id: extension first, then email. Also grab the
  // agent's display name + extension so the note history shows WHO placed
  // the call, not just "Outbound call via Dial 9".
  let agentDisplayName: string | null = null;
  let agentExtensionLabel: string | null = record.agent_extension;
  if (record.agent_extension) {
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email, sip_extension')
      .eq('sip_extension', record.agent_extension)
      .maybeSingle();
    if (data?.id) {
      record.agent_user_id = data.id as string;
      agentDisplayName =
        [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
        data.email ||
        null;
      agentExtensionLabel = (data.sip_extension as string) || agentExtensionLabel;
    }
  }
  if (!record.agent_user_id && record.agent_email) {
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email, sip_extension')
      .ilike('email', record.agent_email)
      .maybeSingle();
    if (data?.id) {
      record.agent_user_id = data.id as string;
      agentDisplayName =
        [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
        data.email ||
        null;
      agentExtensionLabel = (data.sip_extension as string) || agentExtensionLabel;
    }
  }

  // Idempotent upsert on external_call_id when present, else plain insert
  let result;
  if (record.external_call_id) {
    result = await supabase
      .from('zoiper_call_events')
      .upsert(record, { onConflict: 'external_call_id' })
      .select()
      .single();
  } else {
    result = await supabase.from('zoiper_call_events').insert(record).select().single();
  }

  if (result.error) {
    console.error('zoiper-cdr-webhook insert error', result.error);
    return new Response(JSON.stringify({ error: result.error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Auto-log the call against the matched lead:
  //   1. bump sales_leads.call_count and last_contacted_at
  //   2. append a system note in lead_quick_notes (attributed to the agent
  //      if we resolved one, otherwise a system placeholder id)
  // Match rule: normalise the CDR number (dialed for outbound, caller for
  // inbound) to E.164-ish digits and compare against the tail of the phone
  // stored on sales_leads. Tail-match (last 9 digits) handles UK numbers
  // stored with or without the leading 0 / +44.
  // ─────────────────────────────────────────────────────────────────────
  let matchedLeadId: string | null = null;
  let noteId: string | null = null;
  try {
    const rawTarget =
      record.direction === 'inbound' ? record.caller_number : record.dialed_number;
    const normalized = (rawTarget || '').replace(/[^\d]/g, '');
    const tail = normalized.length >= 9 ? normalized.slice(-9) : normalized;

    if (tail) {
      // Find the most recently touched sales lead whose phone ends with the
      // same 9 digits. maybeSingle would throw on multi-match, so cap to 1.
      const { data: leadRows } = await supabase
        .from('sales_leads')
        .select('id, call_count, phone')
        .ilike('phone', `%${tail}`)
        .order('updated_at', { ascending: false })
        .limit(1);

      const lead = leadRows?.[0];
      if (lead) {
        matchedLeadId = lead.id as string;
        const statusLabel = record.status || 'answered';
        const talk = record.talk_seconds ?? record.duration_seconds ?? 0;

        // De-dup guard: the dial9-sync-calls poller can process the SAME call
        // that arrived via this webhook. If we already logged a call for this
        // lead in the last 10 minutes with a matching duration, skip the
        // counter bump / note / lead_call_logs insert so a single Zoiper
        // click doesn't show up twice on Speed to Dial.
        const dedupSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from('lead_call_logs')
          .select('id, duration_seconds')
          .eq('lead_id', matchedLeadId)
          .gte('created_at', dedupSince)
          .order('created_at', { ascending: false })
          .limit(5);
        const duplicate = (recent || []).some((r: any) =>
          Math.abs((r.duration_seconds ?? 0) - talk) <= 2,
        );

        if (duplicate) {
          console.log('zoiper-cdr-webhook duplicate call suppressed', { matchedLeadId, talk });
        } else {
          const nextCount = (lead.call_count || 0) + 1;
          await supabase
            .from('sales_leads')
            .update({
              call_count: nextCount,
              last_contacted_at: record.ended_at || record.started_at,
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchedLeadId);

          const dirLabel = record.direction === 'inbound' ? '📞 Inbound' : '📞 Outbound';
          const mins = Math.floor(talk / 60);
          const secs = talk % 60;
          const durLabel = talk > 0 ? `${mins}m ${secs}s` : '0s';
          const noteText =
            `${dirLabel} call via Dial 9 · ${statusLabel} · ${durLabel}` +
            (rawTarget ? ` · ${rawTarget}` : '');

          const authorId =
            record.agent_user_id || '00000000-0000-0000-0000-000000000000';
          const { data: noteRow } = await supabase
            .from('lead_quick_notes')
            .insert({
              lead_id: matchedLeadId,
              note_text: noteText,
              created_by: authorId,
              is_pinned: false,
            })
            .select('id')
            .single();
          noteId = noteRow?.id ?? null;

          await supabase.from('lead_call_logs').insert({
            lead_id: matchedLeadId,
            agent_id: record.agent_user_id,
            phone_number: rawTarget,
            call_outcome: statusLabel,
            duration_seconds: talk,
          }).then(() => {}, (e) => console.warn('lead_call_logs insert skipped', e?.message));
        }
      }
    }
  } catch (e) {
    console.warn('zoiper-cdr-webhook auto-log failed', (e as Error)?.message);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      id: result.data?.id,
      agent_user_id: record.agent_user_id,
      resolved: !!record.agent_user_id,
      matched_lead_id: matchedLeadId,
      note_id: noteId,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
