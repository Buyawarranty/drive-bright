// Dial 9 Connect API poller.
// Endpoint: GET https://connect.dial9.co.uk/api/v2/calls/list
// Auth: X-Auth-Token + X-Auth-Secret headers.
// Results are returned newest-first; we walk pages until we cross the
// `since` cutoff (default: last 15 minutes) or hit `max_pages`.
//
// Each Dial 9 call becomes a zoiper_call_events row (source: "dial9"),
// plus — for the first insert only — a sales_leads counter bump, a
// system note in lead_quick_notes, and a lead_call_logs entry. That
// pipeline is intentionally identical to zoiper-cdr-webhook so Call
// Stats / Speed to Dial / the Scoreboard pick everything up unchanged.

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

const unixToIso = (v: unknown): string | null => {
  const n = toInt(v);
  if (n === null) return null;
  return new Date(n * 1000).toISOString();
};

// Infer a normalized status from Dial 9's payload. Their `length` is the
// total call duration in seconds; a Hangup event with no `Bridge` before it
// means the call never connected. We approximate with:
//   length >= 3s → answered, else → no_answer.
// Refine later with event inspection if needed.
const inferStatus = (c: any): string => {
  const len = toInt(c.length) ?? 0;
  const events = Array.isArray(c.events) ? c.events : [];
  const bridged = events.some((e: any) => String(e.type || '').toLowerCase().includes('bridge'));
  if (bridged || len >= 3) return 'answered';
  if (len === 0) return 'no_answer';
  return 'no_answer';
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
  const maxPages = Math.min(Math.max(parseInt(url.searchParams.get('max_pages') || '20', 10) || 20, 1), 200);
  const sinceUnix = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Walk pages newest → oldest until we cross the cutoff.
  const calls: any[] = [];
  let pagesFetched = 0;
  let stopped = 'end_of_results';
  try {
    for (let page = 1; page <= maxPages; page++) {
      const resp = await fetch(`${baseUrl}/calls/list?page=${page}&per_page=100`, {
        headers: {
          'X-Auth-Token': token,
          'X-Auth-Secret': secret,
          'Accept': 'application/json',
        },
      });
      const text = await resp.text();
      if (!resp.ok) {
        console.error('dial9 /calls/list failed', resp.status, text);
        return new Response(JSON.stringify({ error: 'dial9_api_failed', status: resp.status, body: text }), {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const json = text ? JSON.parse(text) : {};
      const data: any[] = Array.isArray(json.data) ? json.data : [];
      pagesFetched++;
      if (data.length === 0) { stopped = 'empty_page'; break; }

      let crossed = false;
      for (const c of data) {
        const initiated = toInt(c.initiated_at) ?? 0;
        if (initiated < sinceUnix) { crossed = true; break; }
        calls.push(c);
      }
      if (crossed) { stopped = 'crossed_cutoff'; break; }
      const totalPages = json?.flags?.paginated?.total_pages ?? 1;
      if (page >= totalPages) { stopped = 'last_page'; break; }
    }
  } catch (e) {
    console.error('dial9 fetch threw', (e as Error).message);
    return new Response(JSON.stringify({ error: 'dial9_fetch_failed', details: (e as Error).message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const summary = { fetched: calls.length, pages: pagesFetched, stopped, inserted: 0, matched_leads: 0, errors: 0 };

  for (const c of calls) {
    try {
      const startedAt = unixToIso(c.initiated_at);
      if (!startedAt) continue;

      const dirRaw = String(c.direction || '').toLowerCase();
      const direction = dirRaw.startsWith('in') ? 'inbound' : 'outbound';
      const status = inferStatus(c);
      const length = toInt(c.length) ?? 0;
      const dialed = c?.destination?.e164 ?? c?.destination?.formatted ?? null;
      const caller = c?.source?.e164 ?? c?.source?.formatted ?? null;
      const extension = c.extension_username ? String(c.extension_username) : null;

      const externalId = String(c.uuid ?? c.record_id ?? c.id ?? '');
      if (!externalId) { summary.skipped_no_id++; continue; }

      const record: Record<string, unknown> = {
        external_call_id: externalId,
        agent_email: null,
        agent_extension: extension,
        direction,
        status,
        dialed_number: dialed ? String(dialed) : null,
        caller_number: caller ? String(caller) : null,
        started_at: startedAt,
        answered_at: null,
        ended_at: unixToIso(c.ended_at),
        duration_seconds: length,
        talk_seconds: length,
        raw_payload: { source: 'dial9', ...c },
        agent_user_id: null as string | null,
      };

      if (record.agent_extension) {
        const { data } = await supabase
          .from('admin_users').select('id').eq('sip_extension', record.agent_extension).maybeSingle();
        if (data?.id) record.agent_user_id = data.id;
      }

      const { data: existing } = await supabase
        .from('zoiper_call_events').select('id').eq('external_call_id', externalId).maybeSingle();

      const { error: upsertErr } = await supabase
        .from('zoiper_call_events')
        .upsert(record, { onConflict: 'external_call_id' });
      if (upsertErr) { summary.errors++; if (summary.upsert_errors.length < 3) summary.upsert_errors.push(upsertErr.message); console.error('upsert error', upsertErr.message); continue; }
      if (existing) continue;
      summary.inserted++;

      // Only bump lead counters for outbound answered calls — inbound
      // customer calls are logged but don't count as "dials made" and a
      // 0-second no-answer shouldn't inflate the counter either.
      if (direction !== 'outbound' || status !== 'answered') continue;

      const rawTarget = dialed;
      const normalized = String(rawTarget || '').replace(/[^\d]/g, '');
      const tail = normalized.length >= 9 ? normalized.slice(-9) : normalized;
      if (!tail) continue;

      const { data: leadRows } = await supabase
        .from('sales_leads').select('id, call_count').ilike('phone', `%${tail}`)
        .order('updated_at', { ascending: false }).limit(1);
      const lead = leadRows?.[0];
      if (!lead) continue;

      summary.matched_leads++;
      await supabase.from('sales_leads').update({
        call_count: (lead.call_count || 0) + 1,
        last_contacted_at: record.ended_at || record.started_at,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      const durLabel = length > 0 ? `${Math.floor(length / 60)}m ${length % 60}s` : '0s';
      const noteText = `📞 Outbound call via Dial 9 · ${status} · ${durLabel}` + (rawTarget ? ` · ${rawTarget}` : '');
      const authorId = (record.agent_user_id as string) || '00000000-0000-0000-0000-000000000000';

      await supabase.from('lead_quick_notes').insert({
        lead_id: lead.id, note_text: noteText, created_by: authorId, is_pinned: false,
      });
      await supabase.from('lead_call_logs').insert({
        lead_id: lead.id,
        agent_id: record.agent_user_id,
        phone_number: rawTarget,
        call_outcome: status,
        duration_seconds: length,
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
