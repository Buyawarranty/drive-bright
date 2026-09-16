// Public check for the website chatbot: is a real warranty specialist live right
// now? Agents flip themselves on duty from the Miles chat admin area, which
// writes ai_sandbox_specialist_presence with a heartbeat. Only fresh rows count,
// so a closed tab drops off after a few minutes.
//
// The chat only offers "talk to an agent" when this returns live: true.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** A presence row is only trusted while the heartbeat is recent. */
const FRESH_MS = 3 * 60 * 1000;

function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayIndex, hour };
}

/** Mon–Sat, 9am–6pm UK. */
function withinOpeningHours() {
  const { dayIndex, hour } = londonNow();
  if (dayIndex === 0) return false;
  return hour >= 9 && hour < 18;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('ai_sandbox_specialist_presence')
      .select('display_name, is_online, last_seen_at, override_hours')
      .eq('is_online', true)
      .gte('last_seen_at', new Date(Date.now() - FRESH_MS).toISOString());

    if (error) throw error;

    const open = withinOpeningHours();
    // Outside opening hours only manager-overridden rows count as live.
    const rows = (data ?? []).filter((r) => open || r.override_hours);
    const names = rows
      .map((r) => (r.display_name ?? '').trim().split(/\s+/)[0])
      .filter(Boolean);

    return json({
      live: rows.length > 0,
      count: rows.length,
      names,
      within_hours: open,
    });
  } catch (e) {
    console.error('chat-agent-availability failed', e);
    // Fail safe: never promise a live agent we cannot confirm.
    return json({ live: false, count: 0, names: [], within_hours: withinOpeningHours() });
  }
});
