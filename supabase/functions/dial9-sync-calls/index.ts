// Dial 9 Connect API poller.
// Endpoint: GET https://connect.dial9.co.uk/api/v2/calls/list
// Auth: X-Auth-Token + X-Auth-Secret headers.
// Results are returned newest-first; we walk pages until we cross the
// `since` cutoff (default: last 5 minutes) or hit `max_pages`.
//
// Each Dial 9 call becomes a zoiper_call_events row (source: "dial9"),
// plus — for the first insert only — a sales_leads counter bump, a
// system note in lead_quick_notes, and a lead_call_logs entry.

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

// Inbound calls have no top-level `extension_username` — the answering agent
// only appears inside the Extension event (options.username = "onewarranty-202").
// Without this, every inbound call is attributed to nobody and the agent's
// talk time is under-counted.
const extensionEvents = (c: any) =>
  (Array.isArray(c.events) ? c.events : []).filter(
    (e: any) => String(e?.type || '').toLowerCase() === 'extension',
  );

const deriveExtension = (c: any): string | null => {
  if (c.extension_username) return String(c.extension_username).replace(/^.*-/, '');
  // Pick the extension event with the most talk time (the one that answered).
  let best: any = null;
  for (const e of extensionEvents(c)) {
    const len = toInt(e?.length) ?? 0;
    if (!best || len > (toInt(best?.length) ?? 0)) best = e;
  }
  const username = best?.options?.username;
  return username ? String(username).replace(/^.*-/, '') : null;
};

// Talk time for an inbound call is the length of the answering Extension leg,
// not the whole call (which includes IVR/queue wait).
const deriveTalkSeconds = (c: any, direction: string, totalLen: number): number => {
  if (direction !== 'inbound') return totalLen;
  let best = 0;
  for (const e of extensionEvents(c)) best = Math.max(best, toInt(e?.length) ?? 0);
  return best > 0 ? best : totalLen;
};

// Dial 9 leaves `length` null while a call record is still open — and some
// records never get finalised. Without a fallback those calls are stored as
// 0s, which is why a 30-minute conversation showed up as nothing.
// Fallback order: top-level length → last event end - call start →
// elapsed time since the call was answered (capped by the agent's next call,
// or 4 hours, so a stuck-open record can never run away).
const MAX_CALL_SECONDS = 4 * 60 * 60;

const deriveLength = (c: any, nextStartUnix: number | null): number => {
  const direct = toInt(c.length);
  if (direct !== null && direct > 0) return direct;

  const startUnix = toInt(c.initiated_at);
  const events = Array.isArray(c.events) ? c.events : [];
  let lastEnd: number | null = toInt(c.ended_at);
  let anyOpen = false;
  for (const e of events) {
    const end = toInt(e?.ended_at);
    if (end === null) anyOpen = true;
    else if (lastEnd === null || end > lastEnd) lastEnd = end;
  }
  if (!anyOpen && lastEnd !== null && startUnix !== null) {
    return Math.max(0, Math.min(lastEnd - startUnix, MAX_CALL_SECONDS));
  }
  if (startUnix === null) return direct ?? 0;

  const nowUnix = Math.floor(Date.now() / 1000);
  const cap = nextStartUnix && nextStartUnix > startUnix ? nextStartUnix : nowUnix;
  return Math.max(0, Math.min(cap - startUnix, MAX_CALL_SECONDS));
};

const inferStatus = (c: any): string => {
  const len = toInt(c.length) ?? 0;
  const events = Array.isArray(c.events) ? c.events : [];
  const bridged = events.some((e: any) => String(e.type || '').toLowerCase().includes('bridge'));
  const wentToVoicemail = events.some((e: any) => String(e.type || '').toLowerCase().includes('voicemail'));
  if (wentToVoicemail && !bridged) return 'no_answer';
  if (bridged || len >= 3) return 'answered';
  return 'no_answer';
};

// Derive when the call was picked up.
// Dial 9 doesn't expose `answered_at` directly, but each Extension event carries
// a `ringing` flag and its own initiated_at/ended_at. The moment ringing stops
// on the extension that took the call = the answer time.
// Fallback: for answered calls, ended_at - talk_seconds is a decent estimate.
const deriveAnsweredAt = (c: any, status: string, endedIso: string | null, talkSec: number): string | null => {
  if (status !== 'answered') return null;
  const events = Array.isArray(c.events) ? c.events : [];
  let ringEndUnix: number | null = null;
  for (const e of events) {
    if (e?.ringing !== true) continue;
    const end = toInt(e?.ended_at);
    if (end !== null && (ringEndUnix === null || end > ringEndUnix)) ringEndUnix = end;
  }
  if (ringEndUnix !== null) return new Date(ringEndUnix * 1000).toISOString();
  if (endedIso && talkSec > 0) {
    const t = new Date(endedIso).getTime() - talkSec * 1000;
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return null;
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
  const minutes = Math.min(Math.max(parseInt(url.searchParams.get('minutes') || '5', 10) || 5, 1), 1440);
  const maxPages = Math.min(Math.max(parseInt(url.searchParams.get('max_pages') || '20', 10) || 20, 1), 200);
  const sinceUnix = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const calls: any[] = [];
  let pagesFetched = 0;
  let stopped = 'end_of_results';

  // Dial 9's v2 API ignores query-string params entirely — page/per_page only
  // take effect in a POST JSON body. With GET we were re-reading the same 30
  // newest calls on every "page", so nothing older than a few minutes could
  // ever be synced or corrected. per_page is capped server-side at 60.
  const fetchPage = async (page: number) => {
    const resp = await fetch(`${baseUrl}/calls/list`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': token,
        'X-Auth-Secret': secret,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page, per_page: 60 }),
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`dial9 /calls/list ${resp.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };

  try {
    // Pages are fetched in parallel batches — a sequential walk over a busy
    // day times out long before it reaches the older calls, which is why
    // full-day back-fills used to miss most of the shift.
    const BATCH = 8;
    let page = 1;
    let crossed = false;
    let totalPages = maxPages;
    outer: while (page <= maxPages && page <= totalPages && !crossed) {
      const batch: number[] = [];
      for (let i = 0; i < BATCH && page + i <= Math.min(maxPages, totalPages); i++) batch.push(page + i);
      const results = await Promise.all(batch.map((p) => fetchPage(p)));
      page += batch.length;

      for (const json of results) {
        const data: any[] = Array.isArray(json.data) ? json.data : [];
        pagesFetched++;
        totalPages = json?.flags?.paginated?.total_pages ?? totalPages;
        if (data.length === 0) { stopped = 'empty_page'; break outer; }
        for (const c of data) {
          const initiated = toInt(c.initiated_at) ?? 0;
          if (initiated < sinceUnix) { crossed = true; break; }
          calls.push(c);
        }
        if (crossed) { stopped = 'crossed_cutoff'; break outer; }
      }
    }
    if (!crossed && stopped === 'end_of_results' && page > totalPages) stopped = 'last_page';
  } catch (e) {
    console.error('dial9 fetch threw', (e as Error).message);
    return new Response(JSON.stringify({ error: 'dial9_fetch_failed', details: (e as Error).message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  const summary = { fetched: calls.length, pages: pagesFetched, stopped, inserted: 0, matched_leads: 0, errors: 0, skipped_existing: 0, refreshed: 0 };

  // Bulk pre-fetch already-ingested ids so we skip them without any per-call round trip.
  const allExternalIds = Array.from(new Set(
    calls.map((c) => String(c.uuid ?? c.record_id ?? c.id ?? '')).filter(Boolean),
  ));
  // Existing rows are keyed by external id, but we also keep the stored
  // duration/ended_at. A call that was still IN PROGRESS when we first polled
  // was stored with its length at that moment (e.g. 90s of a 30-minute call)
  // and, because we skip anything already ingested, never grew again. So we
  // refresh those rows whenever Dial 9 now reports a longer/finished call.
  const existing = new Map<string, { id: string; duration_seconds: number | null; ended_at: string | null; agent_extension: string | null }>();
  for (let i = 0; i < allExternalIds.length; i += 500) {
    const slice = allExternalIds.slice(i, i + 500);
    const { data } = await supabase
      .from('zoiper_call_events')
      .select('id, external_call_id, duration_seconds, ended_at, agent_extension')
      .in('external_call_id', slice);
    (data || []).forEach((r: any) => existing.set(String(r.external_call_id), {
      id: r.id,
      duration_seconds: r.duration_seconds,
      ended_at: r.ended_at,
      agent_extension: r.agent_extension,
    }));
  }
  const existingIds = new Set<string>(existing.keys());

  // Cache admin_users lookups by extension.
  const agentCache = new Map<string, { id: string; name: string | null; ext: string | null } | null>();
  const getAgent = async (extension: string | null) => {
    if (!extension) return null;
    if (agentCache.has(extension)) return agentCache.get(extension) || null;
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email, sip_extension')
      .eq('sip_extension', extension)
      .maybeSingle();
    const entry = data?.id
      ? {
          id: data.id as string,
          name: ([data.first_name, data.last_name].filter(Boolean).join(' ').trim() || (data.email as string) || null),
          ext: (data.sip_extension as string) || extension,
        }
      : null;
    agentCache.set(extension, entry);
    return entry;
  };

  // For each extension, the start of that agent's NEXT call bounds how long an
  // unfinished call can possibly have run.
  const nextStartByCall = new Map<string, number>();
  {
    const byExt = new Map<string, any[]>();
    for (const c of calls) {
      const ext = deriveExtension(c) || '_none';
      if (!byExt.has(ext)) byExt.set(ext, []);
      byExt.get(ext)!.push(c);
    }
    for (const list of byExt.values()) {
      list.sort((a, b) => (toInt(a.initiated_at) ?? 0) - (toInt(b.initiated_at) ?? 0));
      for (let i = 0; i < list.length - 1; i++) {
        const id = String(list[i].uuid ?? list[i].record_id ?? list[i].id ?? '');
        const next = toInt(list[i + 1].initiated_at);
        if (id && next !== null) nextStartByCall.set(id, next);
      }
    }
  }

  for (const c of calls) {
    try {
      const externalId = String(c.uuid ?? c.record_id ?? c.id ?? '');
      if (!externalId) continue;

      // Already ingested. Top up the length/end time if the call has since
      // progressed or finished — the side-effects (counter, note, call log)
      // stay one-time-only because we never re-run them here.
      const prior = existing.get(externalId);
      if (prior) {
        const finalLen = deriveLength(c, nextStartByCall.get(externalId) ?? null);
        const priorLen = prior.duration_seconds ?? 0;
        const finalEnded = unixToIso(c.ended_at);
        const refreshedDir = String(c.direction || '').toLowerCase().startsWith('in') ? 'inbound' : 'outbound';
        const refreshedExt = deriveExtension(c);
        const needsUpdate = finalLen > priorLen || (!!finalEnded && !prior.ended_at) || (!!refreshedExt && !prior.agent_extension);
        if (needsUpdate) {
          const refreshedStatus = inferStatus(c);
          const refreshedAgent = prior.agent_extension ? null : await getAgent(refreshedExt);
          const { error: updErr } = await supabase
            .from('zoiper_call_events')
            .update({
              duration_seconds: finalLen,
              talk_seconds: deriveTalkSeconds(c, refreshedDir, finalLen),
              ...(prior.agent_extension ? {} : { agent_extension: refreshedExt, agent_user_id: refreshedAgent?.id ?? null }),
              ended_at: finalEnded,
              status: refreshedStatus,
              answered_at: deriveAnsweredAt(c, refreshedStatus, finalEnded, finalLen),
            })
            .eq('id', prior.id);
          if (updErr) { summary.errors++; console.error('refresh error', updErr.message); }
          else {
            summary.refreshed++;
            prior.duration_seconds = finalLen;
            prior.ended_at = finalEnded;
            prior.agent_extension = prior.agent_extension || refreshedExt;
          }
        } else {
          summary.skipped_existing++;
        }
        continue;
      }

      const startedAt = unixToIso(c.initiated_at);
      if (!startedAt) continue;

      const dirRaw = String(c.direction || '').toLowerCase();
      const direction = dirRaw.startsWith('in') ? 'inbound' : 'outbound';
      const status = inferStatus(c);
      const length = deriveLength(c, nextStartByCall.get(externalId) ?? null);
      const dialed = c?.destination?.e164 ?? c?.destination?.formatted ?? null;
      const caller = c?.source?.e164 ?? c?.source?.formatted ?? null;
      const extension = deriveExtension(c);

      const endedIso = unixToIso(c.ended_at);
      const answeredAt = deriveAnsweredAt(c, status, endedIso, length);
      const agent = await getAgent(extension);
      const record: Record<string, unknown> = {
        external_call_id: externalId,
        agent_email: null,
        agent_extension: extension,
        direction,
        status,
        dialed_number: dialed ? String(dialed) : null,
        caller_number: caller ? String(caller) : null,
        started_at: startedAt,
        answered_at: answeredAt,
        ended_at: endedIso,
        duration_seconds: length,
        talk_seconds: deriveTalkSeconds(c, direction, length),
        raw_payload: { ...c, source: 'dial9', dial9_source: c?.source ?? null },
        agent_user_id: agent?.id ?? null,
      };

      // Insert (not upsert) so a duplicate external_call_id → unique-violation
      // → we can DETECT the duplicate and skip the counter/note side-effects.
      // Previously we upserted, which silently succeeded on the second run and
      // let the bump + note block execute again → 20+ duplicate notes per call.
      const { data: insertedRows, error: insertErr } = await supabase
        .from('zoiper_call_events')
        .insert(record)
        .select('id');
      if (insertErr) {
        // 23505 = unique_violation on external_call_id → already processed.
        if ((insertErr as any).code === '23505') { summary.skipped_existing++; continue; }
        summary.errors++;
        console.error('insert error', insertErr.message);
        continue;
      }
      if (!insertedRows || insertedRows.length === 0) { summary.skipped_existing++; continue; }
      summary.inserted++;
      // Mark as seen so any duplicate later in this same batch also skips.
      existingIds.add(externalId);
      existing.set(externalId, { id: insertedRows[0].id, duration_seconds: length, ended_at: endedIso, agent_extension: extension });

      // Log every outbound attempt — answered AND unanswered. Agents need to
      // see the timestamp of the last attempt so they don't re-dial too soon.
      if (direction !== 'outbound') continue;


      const rawTarget = dialed;
      const normalized = String(rawTarget || '').replace(/[^\d]/g, '');
      const tail = normalized.length >= 9 ? normalized.slice(-9) : normalized;
      if (!tail || tail.length < 9) continue;

      const { data: leadRows } = await supabase
        .rpc('find_sales_lead_by_phone_tail9', { tail_digits: tail });
      const lead = Array.isArray(leadRows) && leadRows.length > 0 ? leadRows[0] : null;
      if (!lead) continue;

      summary.matched_leads++;

      // call_count is now derived by a DB trigger on zoiper_call_events
      // (recompute_sales_lead_call_count) which fires on the insert above.
      // Refetch the fresh value so the note + log show the true call number.
      const { data: freshLead } = await supabase
        .from('sales_leads')
        .select('call_count')
        .eq('id', lead.id)
        .maybeSingle();
      const callNumber = (freshLead?.call_count ?? lead.call_count ?? 1) as number;

      await supabase.from('sales_leads').update({
        last_contacted_at: record.ended_at || record.started_at,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      const durLabel = length > 0 ? `${Math.floor(length / 60)}m ${length % 60}s` : '0s';
      const agentLabel = agent?.name
        ? ` · ${agent.name}${agent.ext ? ` (ext ${agent.ext})` : ''}`
        : extension ? ` · ext ${extension}` : '';
      const statusLabel = status === 'answered' ? 'answered' : 'no answer';
      const icon = status === 'answered' ? '📞' : '📵';
      const noteText = `${icon} Call #${callNumber} via Dial 9${agentLabel} · ${statusLabel} · ${durLabel}` + (rawTarget ? ` · ${rawTarget}` : '');

      const authorId = agent?.id || '00000000-0000-0000-0000-000000000000';

      // Skip duplicate notes/logs if this exact call was already recorded
      // (e.g. the sync ran twice for the same external_call_id in a rare race).
      const { data: existingNote } = await supabase
        .from('lead_quick_notes')
        .select('id')
        .eq('lead_id', lead.id)
        .ilike('note_text', `%${externalId.slice(0, 12)}%`)
        .limit(1);
      const noteSuffix = ` · id:${externalId.slice(0, 12)}`;
      if (!existingNote || existingNote.length === 0) {
        await supabase.from('lead_quick_notes').insert({
          lead_id: lead.id,
          note_text: noteText + noteSuffix,
          created_by: authorId,
          is_pinned: false,
        });
      }

      // lead_call_logs schema: lead_id, lead_type, attempt_number, agent_id,
      // agent_name, outcome, notes, next_follow_up_date.
      // outcome CHECK constraint only allows: no_answer | voicemail | connected |
      // wrong_number | busy | callback_scheduled. Dial 9's inferred status is
      // 'answered' or 'no_answer', so map 'answered' → 'connected'.
      const logOutcome = status === 'answered' ? 'connected' : status;
      const { error: logErr } = await supabase.from('lead_call_logs').insert({
        lead_id: lead.id,
        lead_type: 'sales_lead',
        attempt_number: callNumber,
        agent_id: agent?.id ?? null,
        agent_name: agent?.name ?? null,
        outcome: logOutcome,
        notes: `Dial 9 · ${durLabel}${rawTarget ? ` · ${rawTarget}` : ''}${noteSuffix}`,
      });
      if (logErr) {
        summary.errors++;
        console.error('lead_call_logs insert failed', logErr.message, { logOutcome, lead_id: lead.id });
      }

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
