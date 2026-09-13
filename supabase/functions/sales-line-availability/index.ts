// Public check: should the website chat show the sales phone number right now?
//
// Monday to Friday (9am-6pm UK) the line is staffed, so the number always shows.
// Saturday and Sunday nobody is rostered: agents only occasionally work between
// 10am and 2pm. On those days we only show the number when an agent is actually
// live, proven by activity in the New Leads / Recontact area within the last
// 5 minutes.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const WEEKEND_START_HOUR = 10;
const WEEKEND_END_HOUR = 14;

function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayIndex, hour, minute };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { dayIndex, hour } = londonNow();
    const isWeekend = dayIndex === 0 || dayIndex === 6;

    if (!isWeekend) {
      return json({
        show_phone: hour >= 9 && hour < 18,
        reason: 'weekday_hours',
        agent_live: null,
      });
    }

    const inWeekendWindow = hour >= WEEKEND_START_HOUR && hour < WEEKEND_END_HOUR;
    if (!inWeekendWindow) {
      return json({ show_phone: false, reason: 'weekend_closed', agent_live: false });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();

    const [uiEvents, callLogs] = await Promise.all([
      supabase
        .from('admin_ui_events')
        .select('id')
        .in('tab', ['new-leads', 'recontact-leads', 'leads-per-agent'])
        .gte('created_at', since)
        .limit(1),
      supabase
        .from('lead_call_logs')
        .select('id')
        .gte('created_at', since)
        .limit(1),
    ]);

    const agentLive =
      (uiEvents.data?.length ?? 0) > 0 || (callLogs.data?.length ?? 0) > 0;

    return json({
      show_phone: agentLive,
      reason: agentLive ? 'weekend_agent_live' : 'weekend_no_agent_live',
      agent_live: agentLive,
    });
  } catch (e) {
    console.error('sales-line-availability failed', e);
    // Fail safe: never promise a phone line we cannot confirm at the weekend.
    const { dayIndex } = londonNow();
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    return json({ show_phone: !isWeekend, reason: 'error', agent_live: false });
  }
});
