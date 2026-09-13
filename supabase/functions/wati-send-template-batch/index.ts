import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Turns a UK mobile into WATI's 44... form, or null when it is not a UK mobile. */
const normaliseMobile = (raw: string): string | null => {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  if (!/^07\d{9}$/.test(digits)) return null;
  return `44${digits.slice(1)}`;
};

const BLOCKED_STATUSES = ['do_not_contact', 'unsubscribed', 'fake_lead'];

/**
 * Sends a chosen WhatsApp template to a hand-picked set of existing CRM leads.
 * Every send is queued so it lands on the lead's WhatsApp conversation with
 * delivery status, exactly like the automatic first message.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: canManage } = await admin.rpc('can_manage_lead_routing', { _user_id: userId });
  if (canManage !== true) return json({ error: 'forbidden' }, 403);

  let payload: { leadIds?: string[]; templateName?: string; batchLabel?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const leadIds = Array.from(new Set((payload.leadIds || []).map(String))).slice(0, 1000);
  const templateName = String(payload.templateName || '').trim();
  if (!leadIds.length) return json({ error: 'no_leads' }, 400);
  if (!templateName) return json({ error: 'template_required' }, 400);
  const batchLabel =
    String(payload.batchLabel || '').trim() ||
    `Send ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

  const { data: leads, error: leadsErr } = await admin
    .from('sales_leads')
    .select('id, first_name, last_name, phone, status')
    .in('id', leadIds);
  if (leadsErr) return json({ error: 'leads_read_failed', details: leadsErr.message }, 500);

  const skipped: { leadId: string; name: string; reason: string }[] = [];
  const queueRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const lead of leads || []) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
    if (BLOCKED_STATUSES.includes(String(lead.status))) {
      skipped.push({ leadId: lead.id, name, reason: 'Marked do not contact' });
      continue;
    }
    const phone = normaliseMobile(lead.phone || '');
    if (!phone) {
      skipped.push({ leadId: lead.id, name, reason: 'No UK mobile number' });
      continue;
    }
    if (seen.has(phone)) {
      skipped.push({ leadId: lead.id, name, reason: 'Same number as another lead in this batch' });
      continue;
    }
    seen.add(phone);
    queueRows.push({
      lead_id: lead.id,
      phone_normalized: phone,
      display_name: name || null,
      template_name: templateName,
      force_send: true,
      batch_label: batchLabel,
      status: 'pending',
    });
  }

  if (queueRows.length) {
    const { error: queueErr } = await admin
      .from('whatsapp_auto_message_queue')
      .insert(queueRows);
    if (queueErr) return json({ error: 'queue_failed', details: queueErr.message }, 500);
  }

  // The sender works through 20 numbers per run; the hourly job clears the rest.
  let sendRuns = 0;
  const runs = Math.min(Math.ceil(queueRows.length / 20), 15);
  for (let r = 0; r < runs; r += 1) {
    try {
      await admin.functions.invoke('wati-auto-message', { body: { trigger: 'batch_send' } });
      sendRuns += 1;
    } catch (error) {
      console.error('auto-message invoke failed', error);
      break;
    }
  }

  return json({
    ok: true,
    batchLabel,
    templateName,
    requested: leadIds.length,
    queued: queueRows.length,
    skipped,
    sendRuns,
  });
});
