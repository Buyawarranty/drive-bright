import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { REPORTING_ROLES, invoiceAmounts, reportingEligible, fillReportingTemplate, nextReportingSend, scheduledReportingPeriod } from '../_shared/reporting-rules.ts';
import { reportingWord } from '../_shared/reporting-word.ts';
import { INTERNAL_NOTIFICATION_FROM } from '../_shared/send-internal-notification.ts';
import { logCustomerEmail } from '../_shared/log-email.ts';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Invalid date');
const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), accountId: z.string().uuid(), from: day, to: day }),
  z.object({ action: z.literal('create'), accountId: z.string().uuid(), from: day, to: day, requestId: z.string().uuid() }),
  z.object({ action: z.literal('download'), invoiceId: z.string().uuid(), kind: z.enum(['report','invoice']) }),
  z.object({ action: z.literal('send'), invoiceId: z.string().uuid() }),
  z.object({ action: z.literal('scheduled') }),
]);
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const db = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
function checked<T>(result: {data: T; error: any}) { if(result.error) throw new Error(result.error.message); return result.data; }

async function londonMidnight(date: string) {
  const utc = new Date(`${date}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23' }).format(utc));
  return new Date(utc.getTime() - hour * 3600000).toISOString();
}
async function snapshotFor(client: any, account: any, from: string, to: string) {
  if (from > to || (Date.parse(to)-Date.parse(from))/86400000 > 366) throw new Error('Choose a report period of up to one year');
  const next = new Date(`${to}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1);
  const start = await londonMidnight(from), end = await londonMidnight(next.toISOString().slice(0,10));
  let salesTotal = 0, salesCount = 0;
  const sources: Record<string,{count:number;total:number}> = {};
  for (let offset = 0; ; offset += 1000) {
    const rows = checked(await client.from('customers').select('id,final_amount,status,is_deleted,payment_status,purchase_source,is_manual_entry,warranty_reference_number,signup_date,created_at')
      .or(`and(signup_date.gte.${start},signup_date.lt.${end}),and(signup_date.is.null,created_at.gte.${start},created_at.lt.${end})`).order('id').range(offset,offset+999)) as any[];
    for (const sale of rows) {
      if (!reportingEligible(sale)) continue;
      const source = (sale.purchase_source ?? '').toLowerCase();
      const agent = sale.is_manual_entry || (sale.warranty_reference_number ?? '').startsWith('BAW-S-') || ['quote_link','external','admin_external','manual','admin','phone'].includes(source);
      if ((account.sales_source === 'website' && agent) || (account.sales_source === 'agent' && !agent)) continue;
      const amount = Number(sale.final_amount);
      salesTotal += amount; salesCount++;
      const label = source || (agent ? 'Agent-entered' : 'Website / unrecorded source');
      sources[label] ??= { count:0,total:0 }; sources[label].count++; sources[label].total += amount;
    }
    if (rows.length < 1000) break;
  }
  salesTotal = Math.round(salesTotal*100)/100;
  return { account, from, to, salesTotal, salesCount, sources, ...invoiceAmounts(salesTotal, Number(account.commission_pct), Number(account.vat_pct)) };
}
async function createInvoice(client: any, account: any, from: string, to: string, key: string) {
  const existing = checked(await client.from('reporting_invoices').select('*').eq('scheduled_key',key).maybeSingle());
  if(existing) return existing;
  if(!account.invoice_from.trim() || !account.invoice_to.trim() || Number(account.commission_pct)<=0) throw new Error('Add invoice sender, recipient and a positive charge percentage first');
  const snapshot = await snapshotFor(client,account,from,to);
  const invoiceNumber = checked(await client.rpc('reporting_next_invoice_number'));
  const result = await client.from('reporting_invoices').insert({account_id:account.id,invoice_number:invoiceNumber,period_from:from,period_to:to,sales_total:snapshot.salesTotal,sales_count:snapshot.salesCount,commission_pct:account.commission_pct,commission_amount:snapshot.commission,vat_pct:account.vat_pct,vat_amount:snapshot.vat,total:snapshot.total,snapshot,scheduled_key:key}).select('*').single();
  if (result.error?.code === '23505') return checked(await client.from('reporting_invoices').select('*').eq('scheduled_key',key).single());
  return checked(result);
}
async function sendInvoice(client: any, invoice: any) {
  if(invoice.email_status==='sent') return;
  const current = checked(await client.from('reporting_accounts').select('*').eq('id',invoice.account_id).single()) as any;
  if(!z.string().email().safeParse(current.recipient_email).success) throw new Error('Add a valid recipient email');
  const claimed = checked(await client.rpc('reporting_claim_email',{_invoice:invoice.id})) as boolean;
  if(!claimed) throw new Error('Email is already sending or has been sent');
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY'); if(!apiKey) throw new Error('Email service is not configured');
    const values = { period:`${invoice.period_from} to ${invoice.period_to}`, sales:invoice.sales_total.toFixed(2), commission:invoice.commission_amount.toFixed(2), total:invoice.total.toFixed(2), invoice:invoice.invoice_number };
    const subject = fillReportingTemplate(current.email_subject,values);
    const content = fillReportingTemplate(current.email_body,values);
    const attachments = await Promise.all(['report','invoice'].map(async kind => ({filename:`${invoice.invoice_number}-${kind}.docx`,content:await reportingWord(invoice.snapshot,kind==='invoice'?invoice.invoice_number:undefined)})));
    const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`reporting-${invoice.id}`},body:JSON.stringify({from:INTERNAL_NOTIFICATION_FROM,to:[current.recipient_email],subject,text:content,attachments})});
    if(!response.ok) throw new Error(`Email provider rejected delivery (${response.status})`);
    checked(await client.from('reporting_invoices').update({email_status:'sent',email_error:null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',invoice.id));
    await logCustomerEmail({recipient_email:current.recipient_email,subject,template_name:'head_office_reporting',source_function:'admin-reporting',status:'sent',metadata:{invoice_id:invoice.id}});
  } catch(error) {
    await client.from('reporting_invoices').update({email_status:'failed',email_error:error instanceof Error?error.message:'Delivery failed',updated_at:new Date().toISOString()}).eq('id',invoice.id);
    throw error;
  }
}
Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return respond({error:'Method not allowed'},405);
  try {
    const input = RequestSchema.safeParse(await req.json());
    if(!input.success) return respond({error:'Invalid reporting request'},400);
    const body = input.data;
    if(body.action==='scheduled') {
      // The scheduler has no caller privileges: it can only process enabled, due rows atomically claimed below.
      if(req.headers.get('apikey')!==Deno.env.get('SUPABASE_ANON_KEY')) return respond({error:'Unauthorized'},401);
      const client = db();
      const accounts = checked(await client.from('reporting_accounts').select('*').eq('enabled',true).order('id').limit(100)) as any[];
      let processed=0;
      for(const account of accounts) {
        const now = new Date();
        if(!account.next_send_at) {
          checked(await client.from('reporting_accounts').update({next_send_at:nextReportingSend(account,now)}).eq('id',account.id).eq('enabled',true).is('next_send_at',null)); continue;
        }
        if(new Date(account.next_send_at)>now) continue;
        const claimed = checked(await client.rpc('reporting_claim_due',{_account:account.id,_due:account.next_send_at}));
        if(!claimed) continue;
        try {
          const fresh = checked(await client.from('reporting_accounts').select('*').eq('id',account.id).single()) as any;
          if(!fresh.enabled || fresh.next_send_at!==account.next_send_at) continue;
          const period = scheduledReportingPeriod(fresh,new Date(account.next_send_at));
          const invoice = await createInvoice(client,fresh,period.from,period.to,`scheduled:${account.id}:${account.next_send_at}`);
          await sendInvoice(client,invoice);
          checked(await client.from('reporting_accounts').update({next_send_at:nextReportingSend(fresh,now),last_error:null}).eq('id',account.id).eq('next_send_at',account.next_send_at)); processed++;
        } catch(e) {
          // Failure is visible and requires a person to retry; no permanent retry sweep.
          await client.from('reporting_accounts').update({next_send_at:nextReportingSend(account,now),last_error:e instanceof Error?e.message:'Report delivery failed'}).eq('id',account.id).eq('next_send_at',account.next_send_at);
        }
      }
      return respond({processed});
    }
    const auth = await requireAdmin(req,{allowedRoles:REPORTING_ROLES}); if(!auth.ok) return auth.response;
    const client = auth.supabase;
    if(body.action==='preview'||body.action==='create') {
      const account = checked(await client.from('reporting_accounts').select('*').eq('id',body.accountId).single());
      if(body.action==='preview') return respond({snapshot:await snapshotFor(client,account,body.from,body.to)});
      return respond({invoice:await createInvoice(client,account,body.from,body.to,`manual:${body.accountId}:${body.requestId}`)});
    }
    const invoice = checked(await client.from('reporting_invoices').select('*').eq('id',body.invoiceId).single()) as any;
    if(body.action==='send') { await sendInvoice(client,invoice); return respond({sent:true}); }
    return respond({filename:`${invoice.invoice_number}-${body.kind}.docx`,base64:await reportingWord(invoice.snapshot,body.kind==='invoice'?invoice.invoice_number:undefined)});
  } catch(error) { return respond({error:error instanceof Error?error.message:'Reporting failed'},400); }
});