import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];

/** Yesterday 00:00 to 24:00 UK time, expressed in UTC. */
function yesterdayWindow(): { from: string; to: string; label: string } {
  const now = new Date();
  const uk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const start = new Date(uk);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // Convert the local wall-clock boundaries back to real instants.
  const offsetMs = uk.getTime() - now.getTime();
  return {
    from: new Date(start.getTime() - offsetMs).toISOString(),
    to: new Date(end.getTime() - offsetMs).toISOString(),
    label: start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { from, to, label } = yesterdayWindow();

    const [outbound, inbound, newConvos, optOuts, queueRows, openConvos] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('id, status', { count: 'exact', head: false })
        .eq('direction', 'outbound')
        .gte('created_at', from)
        .lt('created_at', to),
      supabase
        .from('whatsapp_messages')
        .select('conversation_id')
        .eq('direction', 'inbound')
        .gte('created_at', from)
        .lt('created_at', to),
      supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from)
        .lt('created_at', to),
      supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .gte('opted_out_at', from)
        .lt('opted_out_at', to),
      supabase
        .from('whatsapp_auto_message_queue')
        .select('status, template_name')
        .gte('created_at', from)
        .lt('created_at', to),
      supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('is_open', true)
        .is('opted_out_at', null),
    ]);

    const out = outbound.data || [];
    const delivered = out.filter((m: any) => m.status === 'delivered' || m.status === 'read').length;
    const read = out.filter((m: any) => m.status === 'read').length;
    const repliedConvos = new Set((inbound.data || []).map((m: any) => m.conversation_id)).size;
    const queue = queueRows.data || [];
    const pending = queue.filter((r: any) => r.status === 'pending').length;
    const failed = queue.filter((r: any) => r.status === 'failed').length;

    const byTemplate = new Map<string, number>();
    for (const r of queue) {
      if (r.status !== 'sent') continue;
      const key = String(r.template_name || 'unknown');
      byTemplate.set(key, (byTemplate.get(key) || 0) + 1);
    }

    const { data: managers } = await supabase
      .from('admin_users')
      .select('email, role, is_active')
      .in('role', MANAGEMENT_ROLES);

    const recipients = (managers || [])
      .filter((m: any) => m.is_active !== false && m.email)
      .map((m: any) => String(m.email));

    if (recipients.length === 0) return json({ ok: true, skipped: 'no_management_recipients' });

    const pctOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '-');

    const templateRows = [...byTemplate.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<tr><td style="padding:4px 10px">${name}</td><td style="padding:4px 10px">${count}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px">
        <h2 style="margin:0 0 4px">WhatsApp summary - ${label}</h2>
        <p style="margin:0 0 16px;color:#555">Yesterday's WhatsApp activity across the sales team.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:6px 10px;background:#f5f5f5">Messages sent</td><td style="padding:6px 10px"><strong>${out.length}</strong></td></tr>
          <tr><td style="padding:6px 10px">Delivered</td><td style="padding:6px 10px">${delivered} (${pctOf(delivered, out.length)})</td></tr>
          <tr><td style="padding:6px 10px;background:#f5f5f5">Read</td><td style="padding:6px 10px">${read} (${pctOf(read, out.length)})</td></tr>
          <tr><td style="padding:6px 10px">Customers who replied</td><td style="padding:6px 10px"><strong>${repliedConvos}</strong></td></tr>
          <tr><td style="padding:6px 10px;background:#f5f5f5">New conversations</td><td style="padding:6px 10px">${newConvos.count ?? 0}</td></tr>
          <tr><td style="padding:6px 10px">Still waiting to send</td><td style="padding:6px 10px">${pending}</td></tr>
          <tr><td style="padding:6px 10px;background:#f5f5f5">Not delivered</td><td style="padding:6px 10px">${failed}</td></tr>
          <tr><td style="padding:6px 10px">Asked to stop</td><td style="padding:6px 10px">${optOuts.count ?? 0}</td></tr>
          <tr><td style="padding:6px 10px;background:#f5f5f5">Open conversations right now</td><td style="padding:6px 10px">${openConvos.count ?? 0}</td></tr>
        </table>
        ${
          templateRows
            ? `<h3 style="margin:20px 0 6px;font-size:15px">Sent by template</h3>
               <table style="border-collapse:collapse;width:100%;font-size:14px">${templateRows}</table>`
            : ''
        }
        <p style="margin:20px 0 0;font-size:13px;color:#666">
          Full detail is in the admin dashboard under WhatsApp Leads.
        </p>
      </div>`;

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const { error: sendErr } = await resend.emails.send({
      from: 'BuyaWarranty Team <info@buyawarranty.co.uk>',
      to: recipients,
      subject: `WhatsApp summary - ${label}`,
      html,
    });
    if (sendErr) throw new Error(String((sendErr as any)?.message || sendErr));

    return json({ ok: true, recipients: recipients.length, sent: out.length });
  } catch (error: any) {
    console.error('whatsapp-daily-summary failed:', error?.message || error);
    return json({ error: 'summary_failed', details: String(error?.message || error) }, 500);
  }
});
