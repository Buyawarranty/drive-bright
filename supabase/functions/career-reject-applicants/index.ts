import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { CAREERS_FROM, rejectionEmail } from '../_shared/careerEmails.ts';

/**
 * Staff action: decline (or delete) one or many careers applicants right now.
 * Everyone declined or deleted is sent the polite rejection letter first
 * (unless they already received it). Access is checked by reading the rows
 * with the caller's own session, so the existing staff RLS decides who may act.
 */
const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['reject', 'delete']),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorised' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { ids, action } = parsed.data;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return json({ error: 'Email service not configured' }, 500);

    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Unauthorised' }, 401);

    // RLS: only staff allowed to see applications get rows back.
    const { data: rows, error } = await userClient
      .from('career_applications')
      .select('id, full_name, email, role_applied, rejection_sent_at, cv_storage_path')
      .in('id', ids);
    if (error) return json({ error: error.message }, 403);
    if (!rows?.length) return json({ error: 'No applications you can manage' }, 403);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let emailed = 0, done = 0;
    const failed: string[] = [];

    for (const r of rows) {
      let sentAt = r.rejection_sent_at as string | null;
      if (!sentAt && r.email) {
        const letter = rejectionEmail(r.full_name, r.role_applied);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: CAREERS_FROM, to: [r.email], reply_to: 'careers@buyawarranty.co.uk',
            subject: letter.subject, html: letter.html,
          }),
        });
        if (!res.ok) {
          console.error('reject send failed', r.id, res.status, await res.text());
          failed.push(r.full_name);
          continue; // never delete someone whose letter didn't go
        }
        sentAt = new Date().toISOString();
        emailed += 1;
      }

      if (action === 'delete') {
        if (r.cv_storage_path) await admin.storage.from('career-cvs').remove([r.cv_storage_path]);
        const { error: delErr } = await admin.from('career_applications').delete().eq('id', r.id);
        if (delErr) { failed.push(r.full_name); continue; }
      } else {
        const { error: upErr } = await admin.from('career_applications').update({
          status: 'rejected', auto_reject_enabled: false,
          rejection_sent_at: sentAt, decided_at: new Date().toISOString(),
        }).eq('id', r.id);
        if (upErr) { failed.push(r.full_name); continue; }
      }
      done += 1;
    }
    return json({ success: true, done, emailed, failed });
  } catch (e) {
    console.error('career-reject-applicants', e);
    return json({ error: (e as Error).message }, 500);
  }
});
