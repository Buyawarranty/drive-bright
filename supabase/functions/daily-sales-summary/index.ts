// Today's Sales Summary — emailed to accounts@, info@ and support@ at 18:10 UK time.
// Lists every sale signed up today (amount + credited sales agent) in a table,
// with a total and a comparison against the same figures for the previous day.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const RECIPIENTS = ['accounts@buyawarranty.co.uk', 'info@buyawarranty.co.uk', 'support@buyawarranty.co.uk'];
const EXCLUDED_STATUSES = ['cancelled', 'refunded'];
const SALES_ROLES = ['sales', 'sales_lead'];

/** YYYY-MM-DD for "today" in Europe/London, and for N days before it. */
function ukDate(offsetDays = 0): string {
  const todayUk = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(`${todayUk}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const money = (n: number) =>
  `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const prettyDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let target = ukDate(0);
    let previewOnly = false;
    let wrapup = false;
    let overrideTo: string[] | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) target = body.date;
        previewOnly = body?.preview === true;
        wrapup = body?.mode === 'wrapup';
        if (Array.isArray(body?.to) && body.to.length) overrideTo = body.to.map(String);
      } catch { /* no body */ }
    }

    const dayBefore = (() => {
      const d = new Date(`${target}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const dayAfterTarget = (() => {
      const d = new Date(`${target}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const SELECT =
      'id, name, first_name, last_name, registration_plate, plan_type, final_amount, payment_type, status, signup_date, deferred_status, sale_credit_admin_user_id, payment_confirmed_by, quote_sent_by, assigned_to';

    const fetchDay = async (from: string, to: string) => {
      const { data, error } = await supabase
        .from('customers')
        .select(SELECT)
        .gte('signup_date', from)
        .lt('signup_date', to)
        .order('signup_date', { ascending: true });
      if (error) throw error;
      return (data || []).filter(
        (c: any) =>
          !EXCLUDED_STATUSES.includes(String(c.status || '').toLowerCase()) &&
          // Pay later orders only count once the money has actually landed.
          c.deferred_status !== 'pending_payment' &&
          c.deferred_status !== 'cancelled',
      );
    };

    // Convert a UK wall-clock time to a UTC ISO string (handles BST/GMT).
    const londonToUtc = (date: string, hh: number, mm: number) => {
      const guess = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
      const ukHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(guess));
      const offset = (ukHour - hh + 24) % 24;
      return new Date(guess.getTime() - offset * 3600_000).toISOString();
    };

    // 08:30 wrap-up: everything since yesterday's 18:10 summary up to now.
    const [todayRows, yesterdayRows] = wrapup
      ? [await fetchDay(londonToUtc(dayBefore, 18, 10), new Date().toISOString()), [] as any[]]
      : await Promise.all([
          fetchDay(target, dayAfterTarget),
          fetchDay(dayBefore, target),
        ]);

    // Sale credit always belongs to a sales agent; back-office confirmations fall through.
    const { data: admins } = await supabase.from('admin_users').select('id, first_name, last_name, email, role');
    const adminById = new Map<string, any>((admins || []).map((a: any) => [a.id as string, a]));
    const salesIds = new Set((admins || []).filter((a: any) => SALES_ROLES.includes(a.role)).map((a: any) => a.id as string));
    const agentName = (c: any): string => {
      const chain = [c.sale_credit_admin_user_id, c.payment_confirmed_by, c.quote_sent_by, c.assigned_to];
      for (const id of chain) {
        if (id && salesIds.has(id)) {
          const a = adminById.get(id);
          const n = [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim();
          return n || a?.email || 'Agent';
        }
      }
      return 'Website (no agent)';
    };

    const total = (rows: any[]) => rows.reduce((s, r) => s + Number(r.final_amount || 0), 0);
    const todayTotal = total(todayRows);
    const yesterdayTotal = total(yesterdayRows);
    const diff = todayTotal - yesterdayTotal;
    const pct = yesterdayTotal > 0 ? Math.round((diff / yesterdayTotal) * 100) : null;

    const customerName = (c: any) =>
      (c.name && String(c.name).trim()) || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '—';

    const rowsHtml = todayRows.length
      ? todayRows
          .map((c: any, i: number) => {
            const bg = i % 2 ? '#ffffff' : '#f8fafc';
            const time = c.signup_date
              ? new Date(c.signup_date).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })
              : '—';
            return `<tr style="background:${bg}">
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">${esc(customerName(c))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">${esc(c.registration_plate || '—')}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">${esc(c.plan_type || '—')}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">${esc(agentName(c))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">${esc(time)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e6ebf1;text-align:right;white-space:nowrap"><strong>${money(Number(c.final_amount || 0))}</strong></td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="6" style="padding:14px 10px;color:#64748b">No sales recorded for this day.</td></tr>`;

    // Per-agent totals for a quick read.
    const byAgent = new Map<string, { count: number; amount: number }>();
    for (const c of todayRows) {
      const k = agentName(c);
      const cur = byAgent.get(k) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(c.final_amount || 0);
      byAgent.set(k, cur);
    }
    const agentRows = [...byAgent.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(
        ([name, v]) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #e6ebf1">${esc(name)}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #e6ebf1">${v.count}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #e6ebf1;text-align:right">${money(v.amount)}</td></tr>`,
      )
      .join('');

    const upColour = diff >= 0 ? '#15803d' : '#b91c1c';
    const arrow = diff >= 0 ? '▲' : '▼';

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:760px;margin:0 auto;padding:20px">
        <h2 style="margin:0 0 4px;font-size:22px">${wrapup ? 'Evening & overnight wrap-up' : "Today's sales summary"}</h2>
        <p style="margin:0 0 18px;color:#475569">${wrapup ? `Sales since 6:10pm on ${prettyDate(dayBefore)} up to 8:30am today` : prettyDate(target)}</p>

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:22px">
          <tr>
            <td style="padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;width:33%">
              <div style="color:#475569;font-size:12px;text-transform:uppercase">Sales today</div>
              <div style="font-size:22px;font-weight:bold">${todayRows.length}</div>
            </td>
            <td style="padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;width:33%">
              <div style="color:#475569;font-size:12px;text-transform:uppercase">Value today</div>
              <div style="font-size:22px;font-weight:bold">${money(todayTotal)}</div>
            </td>
            ${wrapup ? '' : `<td style="padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;width:34%">
              <div style="color:#475569;font-size:12px;text-transform:uppercase">vs ${prettyDate(dayBefore).split(',')[0]}</div>
              <div style="font-size:22px;font-weight:bold;color:${upColour}">${arrow} ${money(Math.abs(diff))}${pct === null ? '' : ` (${Math.abs(pct)}%)`}</div>
              <div style="color:#475569;font-size:12px">${yesterdayRows.length} sales · ${money(yesterdayTotal)}</div>
            </td>`}
          </tr>
        </table>

        <h3 style="margin:0 0 8px;font-size:16px">${wrapup ? 'Every sale in this window' : 'Every sale today'}</h3>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;text-align:left">
              <th style="padding:8px 10px">Customer</th>
              <th style="padding:8px 10px">Registration</th>
              <th style="padding:8px 10px">Plan</th>
              <th style="padding:8px 10px">Agent</th>
              <th style="padding:8px 10px">Time</th>
              <th style="padding:8px 10px;text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#f1f5f9">
              <td colspan="5" style="padding:10px;font-weight:bold">Total — ${todayRows.length} sale${todayRows.length === 1 ? '' : 's'}</td>
              <td style="padding:10px;text-align:right;font-weight:bold;font-size:16px">${money(todayTotal)}</td>
            </tr>
            ${wrapup ? '' : `<tr>
              <td colspan="5" style="padding:8px 10px;color:#475569">Previous day (${prettyDate(dayBefore)})</td>
              <td style="padding:8px 10px;text-align:right;color:#475569">${money(yesterdayTotal)}</td>
            </tr>`}
          </tfoot>
        </table>

        ${
          agentRows
            ? `<h3 style="margin:24px 0 8px;font-size:16px">By agent</h3>
               <table style="border-collapse:collapse;width:100%;font-size:14px">
                 <thead><tr style="background:#f1f5f9;text-align:left">
                   <th style="padding:6px 10px">Agent</th><th style="padding:6px 10px">Sales</th><th style="padding:6px 10px;text-align:right">Value</th>
                 </tr></thead>
                 <tbody>${agentRows}</tbody>
               </table>`
            : ''
        }

        <p style="margin:24px 0 0;font-size:12px;color:#64748b">
          Cancelled and refunded orders are excluded. Sales are counted by sign-up date and credited to the sales agent who worked the deal.
        </p>
      </div>`;

    const subject = wrapup
      ? `Evening & overnight wrap-up — ${todayRows.length} sales · ${money(todayTotal)} since 6:10pm`
      : `Today's sales summary — ${prettyDate(target)} · ${todayRows.length} sales · ${money(todayTotal)}`;

    if (previewOnly) return json({ ok: true, preview: true, date: target, count: todayRows.length, total: todayTotal, html });

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const { error: sendErr } = await resend.emails.send({
      from: 'BuyaWarranty Sales <info@buyawarranty.co.uk>',
      to: overrideTo ?? RECIPIENTS,
      subject,
      html,
    });
    if (sendErr) throw new Error(String((sendErr as any)?.message || sendErr));

    return json({ ok: true, date: target, count: todayRows.length, total: todayTotal, previous: yesterdayTotal });
  } catch (error: any) {
    console.error('daily-sales-summary failed:', error?.message || error);
    return json({ error: 'summary_failed', details: String(error?.message || error) }, 500);
  }
});
