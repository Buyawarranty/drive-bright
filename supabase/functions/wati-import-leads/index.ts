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

interface IncomingRow {
  name?: string;
  phone?: string;
  email?: string;
  reg?: string;
}

/** Turns a UK mobile into WATI's 44... form, or null when it is not a valid UK mobile. */
const normaliseMobile = (raw: string): string | null => {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  if (!/^07\d{9}$/.test(digits)) return null;
  return `44${digits.slice(1)}`;
};

/**
 * Imports a batch of leads pasted or uploaded by management and queues the
 * default WhatsApp template message for every genuinely new mobile number.
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

  const { data: adminUser } = await admin
    .from('admin_users')
    .select('id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminUser?.id || adminUser.is_active === false) return json({ error: 'forbidden' }, 403);

  const { data: canManage } = await admin.rpc('can_manage_lead_routing', { _user_id: userId });
  if (canManage !== true) return json({ error: 'forbidden' }, 403);

  let payload: { rows?: IncomingRow[]; templateName?: string; batchLabel?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 2000) : [];
  if (!rows.length) return json({ error: 'no_rows' }, 400);

  const { data: settings } = await admin
    .from('whatsapp_auto_message_settings')
    .select('template_name')
    .limit(1)
    .maybeSingle();

  const templateName = String(payload.templateName || settings?.template_name || '').trim();
  if (!templateName) return json({ error: 'template_required' }, 400);
  const batchLabel =
    String(payload.batchLabel || '').trim() ||
    `Import ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

  const skipped: { row: number; name: string; phone: string; reason: string }[] = [];
  const queued: { leadId: string; phone: string; name: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i] || {};
    const name = String(raw.name || '').trim();
    const rawPhone = String(raw.phone || '').trim();
    const email = String(raw.email || '').trim().toLowerCase();
    const reg = String(raw.reg || '').trim().toUpperCase().replace(/\s/g, '');

    const phone = normaliseMobile(rawPhone);
    if (!phone) {
      skipped.push({ row: i + 1, name, phone: rawPhone, reason: 'Not a UK mobile number' });
      continue;
    }
    if (seen.has(phone)) {
      skipped.push({ row: i + 1, name, phone: rawPhone, reason: 'Repeated in this file' });
      continue;
    }
    seen.add(phone);

    const localPhone = `0${phone.slice(2)}`;
    const tail9 = phone.slice(-9);

    try {
      // Never create a second lead for a number we already hold.
      const { data: match } = await admin.rpc('find_sales_lead_by_phone_tail9', {
        tail_digits: tail9,
      });
      const existingLeadId: string | null =
        Array.isArray(match) && match[0]?.id ? match[0].id : null;

      if (existingLeadId) {
        skipped.push({ row: i + 1, name, phone: rawPhone, reason: 'Already a lead in the CRM' });
        continue;
      }

      const nameParts = name.split(/\s+/).filter(Boolean);
      const { data: lead, error: leadErr } = await admin
        .from('sales_leads')
        .insert({
          first_name: nameParts[0] || 'WhatsApp',
          last_name: nameParts.slice(1).join(' ') || 'import',
          // sales_leads.email is required; phone-only imports get a routing address.
          email: email || `import_${tail9}_${Date.now()}@nomail.temp`,
          phone: localPhone,
          vehicle_reg: reg || null,
          lead_source: 'other',
          status: 'new',
          original_source: 'whatsapp_import',
          notes: `Imported batch: ${batchLabel}`,
        })
        .select('id')
        .single();
      if (leadErr) throw new Error(leadErr.message);

      const { error: queueErr } = await admin.from('whatsapp_auto_message_queue').insert({
        lead_id: lead.id,
        phone_normalized: phone,
        display_name: name || null,
        template_name: templateName,
        force_send: true,
        batch_label: batchLabel,
        status: 'pending',
      });
      if (queueErr) throw new Error(queueErr.message);

      queued.push({ leadId: lead.id, phone, name });
    } catch (error: any) {
      skipped.push({
        row: i + 1,
        name,
        phone: rawPhone,
        reason: String(error?.message || error).slice(0, 200),
      });
    }
  }

  // Kick the sender off straight away; it works through 20 numbers per run and
  // the hourly job picks up anything left over.
  let sendRuns = 0;
  const runs = Math.min(Math.ceil(queued.length / 20), 10);
  for (let r = 0; r < runs; r += 1) {
    try {
      await admin.functions.invoke('wati-auto-message', { body: { trigger: 'import' } });
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
    received: rows.length,
    imported: queued.length,
    skipped,
    sendRuns,
  });
});
