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
  const provided = req.headers.get('x-zoiper-secret') || '';
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

  // Resolve agent_user_id: extension first, then email
  if (record.agent_extension) {
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .eq('sip_extension', record.agent_extension)
      .maybeSingle();
    if (data?.id) record.agent_user_id = data.id as string;
  }
  if (!record.agent_user_id && record.agent_email) {
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .ilike('email', record.agent_email)
      .maybeSingle();
    if (data?.id) record.agent_user_id = data.id as string;
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

  return new Response(
    JSON.stringify({
      ok: true,
      id: result.data?.id,
      agent_user_id: record.agent_user_id,
      resolved: !!record.agent_user_id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
