import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CAREERS_FROM, rejectionEmail } from '../_shared/careerEmails.ts';

/**
 * Automatic careers rejection sweep.
 *
 * Runs on a schedule. Any application still sitting on status `new` once its
 * five-working-day deadline has passed gets the polite rejection letter and is
 * moved to `rejected`. Giving an applicant ANY other status (shortlisted,
 * interview, hired, on hold) permanently takes them out of this sweep.
 *
 * Safety rails:
 *  - bounded batch per run (BATCH_SIZE)
 *  - single-flight lease so two overlapping runs can't double-send
 *  - progress marked per applicant, in the same step that sends the email
 *  - pauses itself and reports when the email provider is misconfigured
 */

const BATCH_SIZE = 25;
const LEASE_KEY = 'career_rejection_sweep_lease';
const LEASE_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!RESEND_API_KEY) {
      console.error('[career-rejection-sweep] RESEND_API_KEY missing — pausing');
      return json({ error: 'Email service not configured', paused: true }, 500);
    }

    // ---- Single-flight lease -------------------------------------------------
    const now = new Date();
    const { data: lease } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', LEASE_KEY)
      .maybeSingle();

    const heldUntil = (lease?.config_value as any)?.until
      ? new Date((lease!.config_value as any).until)
      : null;
    if (heldUntil && heldUntil > now) {
      console.log('[career-rejection-sweep] another run holds the lease, exiting');
      return json({ skipped: 'locked' });
    }

    await supabase.from('admin_config').upsert(
      {
        config_key: LEASE_KEY,
        config_value: { until: new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString() },
        updated_at: now.toISOString(),
      },
      { onConflict: 'config_key' },
    );

    // ---- Find applications whose deadline has passed ------------------------
    const { data: due, error: dueErr } = await supabase
      .from('career_applications')
      .select('id, full_name, email, role_applied')
      .eq('status', 'new')
      .eq('auto_reject_enabled', true)
      .is('rejection_sent_at', null)
      .lte('rejection_due_at', now.toISOString())
      .order('rejection_due_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (dueErr) {
      console.error('[career-rejection-sweep] query failed', dueErr);
      return json({ error: dueErr.message }, 500);
    }

    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const app of due || []) {
      // No email address on file — close it out silently so it stops recurring.
      if (!app.email) {
        await supabase
          .from('career_applications')
          .update({
            status: 'rejected',
            auto_reject_enabled: false,
            internal_notes: 'Auto-rejected. No email address on file, so no letter was sent.',
          })
          .eq('id', app.id)
          .eq('status', 'new');
        skipped += 1;
        continue;
      }

      const letter = rejectionEmail(app.full_name, app.role_applied);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: CAREERS_FROM,
          to: [app.email],
          reply_to: 'careers@buyawarranty.co.uk',
          subject: letter.subject,
          html: letter.html,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[career-rejection-sweep] send failed for ${app.id}: ${res.status} ${text}`);
        failures.push(app.id);
        // Rate limited or provider down — stop the batch, next run picks up.
        if (res.status === 429 || res.status >= 500) break;
        continue;
      }

      // Mark progress in the same step as the send.
      const { error: markErr } = await supabase
        .from('career_applications')
        .update({
          status: 'rejected',
          rejection_sent_at: new Date().toISOString(),
          auto_reject_enabled: false,
        })
        .eq('id', app.id)
        .eq('status', 'new');

      if (markErr) console.error('[career-rejection-sweep] mark failed', app.id, markErr);
      sent += 1;
    }

    // Release the lease.
    await supabase.from('admin_config').upsert(
      {
        config_key: LEASE_KEY,
        config_value: { until: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'config_key' },
    );

    console.log(`[career-rejection-sweep] sent=${sent} skipped=${skipped} failed=${failures.length}`);
    return json({ success: true, sent, skipped, failed: failures.length });
  } catch (e) {
    console.error('[career-rejection-sweep] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
