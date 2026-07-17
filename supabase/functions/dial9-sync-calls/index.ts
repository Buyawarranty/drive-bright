// Dial 9 Connect API poller.
// Pulls recent CDRs from Dial 9 and upserts them into zoiper_call_events,
// then bumps sales_leads.call_count / last_contacted_at and drops a
// system note — mirroring the zoiper-cdr-webhook pipeline so the rest of
// the app (Call Stats, Speed to Dial, Scoreboard) picks them up unchanged.
//
// Auth to Dial 9: X-Auth-Token + X-Auth-Secret headers.
// Env required: DIAL9_API_TOKEN, DIAL9_API_SECRET, DIAL9_API_BASE_URL
//               (defaults to https://connect.dial9.co.uk/api/v2)
//
// Trigger: pg_cron every 2 minutes, or invoke manually with `?minutes=60`
// to backfill a wider window.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

const toIso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Map Dial 9 disposition codes → our normalized status set
const mapStatus = (raw: string | null | undefined): string => {
  const s = (raw || '').toLowerCase();
  if (s.includes('answer')) return 'answered';
  if (s.includes('busy')) return 'busy';
  if (s.includes('no_answer') || s.includes('noanswer')) return 'no_answer';
  if (s.includes('miss')) return 'missed';
  if (s.includes('fail')) return 'failed';
  if (s.includes('cancel')) return 'cancelled';
  return s || 'answered';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('DIAL9_API_TOKEN');
  const secret = Deno.env.get('DIAL9_API_SECRET');
  const baseUrl = (Deno.env.get('DIAL9_API_BASE_URL') || 'https://connect.dial9.co.uk/api/v2').replace(/\/$/, '');

  if (!token || !secret) {
    return new Response(JSON.stringify({ error: 'DIAL9_API_TOKEN or DIAL9_API_SECRET not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const minutes = Math.min(Math.max(parseInt(url.searchParams.get('minutes') || '15', 10) || 15, 1), 1440);
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Fetch calls from Dial 9. Their /calls endpoint accepts unix `from`/`to`
  // seconds and paginates via `page`.
  const params = new URLSearchParams({
    from: String(Math.floor(since.getTime() / 1000)),
    to: String(Math.floor(Date.now() / 1000)),
    per_page: '200',
  });

  let calls: any[] = [];
  let dial9Error: string | null = null;
  try {
    const resp = await fetch(`${baseUrl}/calls?${params.toString()}`, {
      headers: {
        'X-Auth-Token': token,
        'X-Auth-Secret': secret,
        'Accept': 'application/json',
      },
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error('dial9 /calls failed', resp.status, text);
      return new Response(JSON.stringify({ error: 'dial9_api_failed', status: resp.status, body: text }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const json = text ? JSON.parse(text) : {};
    // Dial 9 usually wraps rows under `data` or `calls`; accept either.
    calls = Array.isArray(json) ? json : (json.data || json.calls || json.records || []);
  } catch (e) {
    dial9Error = (e as Error).message;
    console.error('dial9 fetch threw', dial9Error);
    return new Response(JSON.stringify({ error: 'dial9_fetch_failed', details: dial9Error }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const summary = { fetched: calls.length, inserted: 0, matched_leads: 0, errors: 0 };

  for (const c of calls) {
    try {
      const startedAt = toIso(c.started_at ?? c.start_time ?? c.created_at);
      if (!startedAt) continue;

      const direction = (String(c.direction || 'outbound')).toLowerCase();
      const status = mapStatus(c.status ?? c.disposition ?? c.result);
      const dialed = c.destination_number ?? c.destination ?? c.dialed_number ?? c.to ?? null;
      const caller = c.caller_id_number ?? c.caller ?? c.from ?? null;
      const extension = c.extension ?? c.agent_extension ?? c.user_extension ?? c.user?.extension ?? null;
      const email = (c.user_email ?? c.agent_email ?? c.user?.email_address ?? c.user?.email ?? '') || null;
      const talk = toInt(c.talk_time ?? c.billsec ?? c.talk_seconds);
      const duration = toInt(c.duration ?? c.duration_seconds);

      const record: Record<string, unknown> = {
        external_call_id: String(c.uuid ?? c.id ?? c.call_id ?? ''),
        agent_email: email ? String(email).toLowerCase() : null,
        agent_extension: extension ? String(extension) : null,
        direction: direction.includes('in') ? 'inbound' : 'outbound',
        status,
        dialed_number: dialed ? String(dialed) : null,
        caller_number: caller ? String(caller) : null,
        started_at: startedAt,
        answered_at: toIso(c.answered_at ?? c.answer_time),
        ended_at: toIso(c.ended_at ?? c.end_time ?? c.hangup_time),
        duration_seconds: duration,
        talk_seconds: talk,
        raw_payload: { source: 'dial9', ...c },
        agent_user_id: null as string | null,
      };

      if (!record.external_call_id) continue;

      // Resolve agent
      if (record.agent_extension) {
        const { data } = await supabase
          .from('admin_users').select('id').eq('sip_extension', record.agent_extension).maybeSingle();
        if (data?.id) record.agent_user_id = data.id;
      }
      if (!record.agent_user_id && record.agent_email) {
        const { data } = await supabase
          .from('admin_users').select('id').ilike('email', record.agent_email as string).maybeSingle();
        if (data?.id) record.agent_user_id = data.id;
      }

      // Upsert. If the row already exists we skip the counter bump so cron
      // re-runs are idempotent.
      const { data: existing } = await supabase
        .from('zoiper_call_events').select('id').eq('external_call_id', record.external_call_id).maybeSingle();

      const { error: upsertErr } = await supabase
        .from('zoiper_call_events')
        .upsert(record, { onConflict: 'external_call_id' });
      if (upsertErr) {
        summary.errors++;
        console.error('upsert error', upsertErr.message);
        continue;
      }
      if (existing) continue; // already processed, don't double-bump
      summary.inserted++;

      // Match lead by tail digits and bump counter + note
      const rawTarget = record.direction === 'inbound' ? record.caller_number : record.dialed_number;
      const normalized = String(rawTarget || '').replace(/[^\d]/g, '');
      const tail = normalized.length >= 9 ? normalized.slice(-9) : normalized;
      if (!tail) continue;

      const { data: leadRows } = await supabase
        .from('sales_leads').select('id, call_count').ilike('phone', `%${tail}`)
        .order('updated_at', { ascending: false }).limit(1);
      const lead = leadRows?.[0];
      if (!lead) continue;

      summary.matched_leads++;
      const nextCount = (lead.call_count || 0) + 1;
      await supabase.from('sales_leads').update({
        call_count: nextCount,
        last_contacted_at: record.ended_at || record.started_at,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      const dirLabel = record.direction === 'inbound' ? '📞 Inbound' : '📞 Outbound';
      const t = (talk ?? duration ?? 0) as number;
      const durLabel = t > 0 ? `${Math.floor(t / 60)}m ${t % 60}s` : '0s';
      const noteText = `${dirLabel} call via Dial 9 · ${status} · ${durLabel}` + (rawTarget ? ` · ${rawTarget}` : '');
      const authorId = (record.agent_user_id as string) || '00000000-0000-0000-0000-000000000000';

      await supabase.from('lead_quick_notes').insert({
        lead_id: lead.id, note_text: noteText, created_by: authorId, is_pinned: false,
      });
      await supabase.from('lead_call_logs').insert({
        lead_id: lead.id,
        agent_id: record.agent_user_id,
        phone_number: rawTarget,
        call_outcome: status,
        duration_seconds: t,
      }).then(() => {}, () => {});
    } catch (e) {
      summary.errors++;
      console.error('process call failed', (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ ok: true, window_minutes: minutes, ...summary }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
