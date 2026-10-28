// Scheduled lead-opening rate check.
//
// Runs every few minutes from pg_cron. Looks at the openings and phone-number
// copies recorded in the last window (default 10 minutes) and asks, for each
// member of staff: how many leads did you look at, and how many of those did
// you then actually call? Someone working the phone dials the number they just
// looked at — even when nobody answers, so they are never flagged. Someone
// collecting numbers opens lead after lead without dialling, and that trips the
// alert. Admins and super admins get an email and a card in Live Alerts naming
// the person and the breakdown. Nothing is blocked; this only tells you.
//
// Auth: the scheduler calls with the project anon key (or the service key).
// Staff/customer session tokens are refused — the check reads nothing about
// the caller and returns only counts.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendInternalNotification } from '../_shared/send-internal-notification.ts';
import {
  ALERT_COOLDOWN_MINUTES,
  DEFAULT_OPENING_THRESHOLD,
  DEFAULT_WINDOW_MINUTES,
  DIAL_LEAD_MS,
  describeActivity,
  isRapidOpening,
  summariseOpenings,
  type AccessEvent,
  type ActorActivity,
  type DialAttempt,
} from '../_shared/leadOpeningRate.ts';

const ALERT_KIND = 'rapid_lead_opening';
const MAX_ROWS = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Client = ReturnType<typeof createClient>;

const bearer = (req: Request) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

/** The role claim of a Supabase key or session token, or null if unreadable. */
const roleOf = (token: string): string | null => {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
};

/**
 * Only the database trigger (which presents the project anon key) or a service
 * call may run this. A staff or customer session carries a bearer token whose
 * role is "authenticated", so it is refused outright.
 */
const isTrustedCaller = (req: Request) => {
  const auth = bearer(req);
  const apikey = req.headers.get('apikey') || '';
  const allowed = (token: string) => {
    const role = roleOf(token);
    return role === 'anon' || role === 'service_role';
  };
  if (auth && !allowed(auth)) return false;
  return allowed(auth || apikey);
};

const chunk = <T>(items: T[], size = 400): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

interface Settings {
  enabled: boolean;
  threshold: number;
  windowMinutes: number;
  emails: string[];
}

const readSettings = async (db: Client): Promise<Settings> => {
  const fallback: Settings = {
    enabled: true,
    threshold: DEFAULT_OPENING_THRESHOLD,
    windowMinutes: DEFAULT_WINDOW_MINUTES,
    emails: ['info@buyawarranty.co.uk', 'support@buyawarranty.co.uk'],
  };
  const { data, error } = await db.from('lead_opening_rate_settings').select('*').eq('id', true).maybeSingle();
  if (error || !data) return fallback;
  const emails = Array.isArray(data.alert_emails)
    ? (data.alert_emails as string[]).filter((e) => typeof e === 'string' && EMAIL_RE.test(e))
    : fallback.emails;
  return {
    enabled: data.enabled !== false,
    threshold: Number.isFinite(data.threshold) ? Math.max(1, Number(data.threshold)) : fallback.threshold,
    windowMinutes: Number.isFinite(data.window_minutes)
      ? Math.min(180, Math.max(1, Number(data.window_minutes)))
      : fallback.windowMinutes,
    emails: emails.length ? emails : fallback.emails,
  };
};

const staffLabel = (row: { first_name: string | null; last_name: string | null; email: string }) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  if (!isTrustedCaller(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const settings = await readSettings(db);
  if (!settings.enabled) {
    return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), { status: 200 });
  }

  const now = Date.now();
  const windowStart = now - settings.windowMinutes * 60_000;
  const dialStart = now - (settings.windowMinutes * 60_000 + DIAL_LEAD_MS);

  const { data: eventRows, error: eventError } = await db
    .from('lead_access_events')
    .select('actor_id, lead_id, occurred_at')
    .gte('occurred_at', new Date(windowStart).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(MAX_ROWS);

  if (eventError) {
    return new Response(JSON.stringify({ ok: false, error: eventError.message }), { status: 500 });
  }

  const events: AccessEvent[] = (eventRows || []).map((row) => ({
    actorId: row.actor_id as string,
    leadId: row.lead_id as string,
    occurredAt: Date.parse(row.occurred_at as string),
  }));

  const leadIds = [...new Set(events.map((e) => e.leadId).filter(Boolean))];
  const leadPhones = new Map<string, string>();
  for (const ids of chunk(leadIds)) {
    const { data } = await db.from('sales_leads').select('id, phone').in('id', ids);
    for (const lead of data || []) {
      if (lead.phone) leadPhones.set(lead.id as string, lead.phone as string);
    }
  }

  const dials: DialAttempt[] = [];

  const { data: zoiperRows } = await db
    .from('zoiper_call_events')
    .select('agent_user_id, dialed_number, started_at, status, talk_seconds')
    .eq('direction', 'outbound')
    .not('agent_user_id', 'is', null)
    .gte('started_at', new Date(dialStart).toISOString())
    .lte('started_at', new Date(now).toISOString())
    .limit(MAX_ROWS);
  for (const row of zoiperRows || []) {
    if (!row.started_at || !row.agent_user_id) continue;
    dials.push({
      actorId: row.agent_user_id as string,
      at: Date.parse(row.started_at as string),
      phone: (row.dialed_number as string) ?? null,
      connected: row.status === 'answered' && Number(row.talk_seconds ?? 0) > 0,
    });
  }

  const { data: logRows } = await db
    .from('lead_call_logs')
    .select('agent_id, lead_id, outcome, created_at')
    .not('agent_id', 'is', null)
    .gte('created_at', new Date(dialStart).toISOString())
    .lte('created_at', new Date(now).toISOString())
    .limit(MAX_ROWS);
  for (const row of logRows || []) {
    if (!row.created_at || !row.agent_id) continue;
    dials.push({
      actorId: row.agent_id as string,
      at: Date.parse(row.created_at as string),
      leadId: (row.lead_id as string) ?? null,
      connected: row.outcome === 'connected',
    });
  }

  const activities = summariseOpenings(events, leadPhones, dials);
  const flagged = [...activities.values()].filter((activity) => isRapidOpening(activity, settings.threshold));

  if (flagged.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, checked: activities.size, flagged: 0, threshold: settings.threshold }),
      { status: 200 },
    );
  }

  // Don't knock twice for the same person inside the cooldown.
  const { data: recent } = await db
    .from('security_alerts')
    .select('actor_id')
    .eq('kind', ALERT_KIND)
    .gte('created_at', new Date(now - ALERT_COOLDOWN_MINUTES * 60_000).toISOString())
    .limit(MAX_ROWS);
  const alreadyAlerted = new Set((recent || []).map((row) => row.actor_id as string));
  const fresh = flagged.filter((activity) => !alreadyAlerted.has(activity.actorId));

  if (fresh.length === 0) {
    return new Response(JSON.stringify({ ok: true, checked: activities.size, flagged: 0, deduped: flagged.length }), {
      status: 200,
    });
  }

  const { data: staffRows } = await db
    .from('admin_users')
    .select('id, email, first_name, last_name')
    .in('id', fresh.map((activity) => activity.actorId));
  const staffById = new Map((staffRows || []).map((row) => [row.id as string, row]));

  const people = fresh.map((activity) => {
    const staff = staffById.get(activity.actorId);
    return {
      activity,
      name: staff ? staffLabel(staff) : 'Unknown staff member',
      email: staff?.email ?? 'unknown',
    };
  });

  for (const person of people) {
    await db.from('security_alerts').insert({
      kind: ALERT_KIND,
      actor_id: person.activity.actorId,
      title: `${person.name} opened ${person.activity.noDial} leads without dialling`,
      message: describeActivity(person.activity).join(' · '),
      detail: {
        opened: person.activity.opened,
        with_dial: person.activity.withDial,
        connected: person.activity.connected,
        no_dial: person.activity.noDial,
        threshold: settings.threshold,
        window_minutes: settings.windowMinutes,
      },
    });
  }

  const rowsHtml = people
    .map(
      (person) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${person.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${person.email}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${person.activity.opened}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${person.activity.withDial}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${person.activity.connected}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#b91c1c">${person.activity.noDial}</td>
      </tr>`,
    )
    .join('');

  const subject =
    people.length === 1
      ? `Lead opening check: ${people[0].name} opened ${people[0].activity.noDial} leads with no calls`
      : `Lead opening check: ${people.length} staff opened leads with no calls`;

  const text = people
    .map(
      (person) =>
        `${person.name} (${person.email})\n${describeActivity(person.activity)
          .map((line) => `  ${line}`)
          .join('\n')}`,
    )
    .join('\n\n');

  const html = `<p>In the last ${settings.windowMinutes} minutes, ${
    people.length === 1 ? 'this person' : 'these people'
  } opened leads or copied phone numbers ${settings.threshold} or more times without a call to that lead afterwards. Calls that rang out or went to voicemail count as calls, so this is not about unanswered dials — it is about openings with no dial at all.</p>
  <table style="border-collapse:collapse;font-size:14px">
    <thead><tr>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:left">Who</th>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:left">Email</th>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:right">Opened</th>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:right">Called</th>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:right">Reached</th>
      <th style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:right">No call</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p>Nothing has been blocked. Open <strong>Admin dashboard → Staff access &amp; security log</strong> to see exactly which leads were opened and when.</p>`;

  const sent = await sendInternalNotification({
    to: settings.emails,
    subject,
    html,
    text,
    template: 'lead-opening-rate-alert',
    sourceFunction: 'lead-opening-rate-alert',
    metadata: { flagged: people.map((person) => person.email), threshold: settings.threshold },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      checked: activities.size,
      flagged: people.length,
      emails: settings.emails,
      emailOk: sent.ok,
      emailError: sent.error ?? null,
    }),
    { status: 200 },
  );
});
