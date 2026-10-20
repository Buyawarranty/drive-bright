import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Plus, Save, Send, RefreshCw, Receipt, Eye } from 'lucide-react';
import { toast } from 'sonner';

const money = (v: number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(v);
const defaults = { name:'', recipient_email:'', cc_email:'', commission_pct:0, vat_pct:0, email_subject:'Sales and commission report — {{period}}', email_body:'Please find the sales report and head office invoice attached for {{period}}.', document_intro:'Sales and head office commission summary', invoice_from:'', invoice_to:'', payment_details:'', sales_source:'all', enabled:false, frequency:'weekly', weekday:6, monthday:1, send_hour:9 };
type Account = typeof defaults & {id?:string;last_error?:string|null;next_send_at?:string|null};
type Invoice = {id:string;account_id:string;invoice_number:string;period_from:string;period_to:string;sales_total:number;total:number;email_status:string;email_error:string|null};
type Payment = {id:string;invoice_id:string;amount:number;paid_on:string;reference:string};
type Summary = {salesTotal:number;salesCount:number;commission:number;vat:number;total:number};
async function invoke(body: Record<string,unknown>) {
  const {data,error} = await supabase.functions.invoke('admin-reporting',{body});
  if(error) {
    let message = error.message;
    try { const details = await error.context?.json(); if(details?.error) message=details.error; } catch { /* fallback */ }
    throw new Error(message);
  }
  if(data?.error) throw new Error(data.error);
  return data;
}
export default function ReportingTab() {
  const [accounts,setAccounts] = useState<Account[]>([]);
  const [account,setAccount] = useState<Account|null>(null);
  const [invoices,setInvoices] = useState<Invoice[]>([]);
  const [payments,setPayments] = useState<Payment[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  const [from,setFrom] = useState(`${today.slice(0,7)}-01`);
  const [to,setTo] = useState(today);
  const [summary,setSummary] = useState<Summary|null>(null);
  const [paymentInvoice,setPaymentInvoice] = useState<Invoice|null>(null);
  const [paymentAmount,setPaymentAmount] = useState('');
  const [paymentDate,setPaymentDate] = useState(today);
  const [paymentRef,setPaymentRef] = useState('');
  const [sendConfirm,setSendConfirm] = useState<Invoice|null>(null);
  const [canAccess,setCanAccess] = useState(false);
  const paid = (id:string) => payments.filter(p=>p.invoice_id===id).reduce((n,p)=>n+Number(p.amount),0);
  const selectedInvoices = invoices.filter(i=>i.account_id===account?.id);
  const outstanding = selectedInvoices.reduce((n,i)=>n+Number(i.total)-paid(i.id),0);
  const update = (key:keyof Account,value:unknown) => {setAccount(a=>a?{...a,[key]:value}:a);setSummary(null);};
  async function load(preserve=true) {
    setLoading(true);setError('');
    try {
      const {data:allowed,error:accessError} = await supabase.rpc('can_manage_reporting');
      if(accessError) throw accessError;
      setCanAccess(allowed===true); if(!allowed) return;
      const allInvoices: Invoice[]=[]; const allPayments:Payment[]=[];
      const a=await supabase.from('reporting_accounts').select('*').order('name'); if(a.error) throw a.error;
      for(let page=0;;page++) {const r=await supabase.from('reporting_invoices').select('id,account_id,invoice_number,period_from,period_to,sales_total,total,email_status,email_error').order('created_at',{ascending:false}).order('id').range(page*1000,page*1000+999);if(r.error) throw r.error;allInvoices.push(...r.data);if(r.data.length<1000)break;}
      for(let page=0;;page++) {const r=await supabase.from('reporting_payments').select('*').order('created_at').order('id').range(page*1000,page*1000+999);if(r.error)throw r.error;allPayments.push(...r.data);if(r.data.length<1000)break;}
      setAccounts(a.data);setInvoices(allInvoices);setPayments(allPayments);
      setAccount(previous=>preserve&&previous?.id?(a.data.find(x=>x.id===previous.id)??null):a.data[0]??null);
    } catch(e) {setError(e instanceof Error?e.message:'Could not load reporting');} finally {setLoading(false);}
  }
  useEffect(()=>{void load(false);},[]);
  async function run(action:()=>Promise<void>) {setBusy(true);try{await action();}catch(e){toast.error(e instanceof Error?e.message:'Reporting failed');}finally{setBusy(false);}}
  async function save() {
    if(!account || !account.name.trim()) throw new Error('Add the account name');
    const fields = Object.fromEntries(Object.keys(defaults).map(k=>[k,account[k as keyof Account]])) as typeof defaults;
    const result=account.id?await supabase.from('reporting_accounts').update(fields).eq('id',account.id):await supabase.from('reporting_accounts').insert(fields);
    if(result.error)throw result.error;
    await load();toast.success('Reporting account saved');
  }
  async function download(invoice:Invoice,kind:'report'|'invoice') {
    const data = await invoke({action:'download',invoiceId:invoice.id,kind});
    const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    const link=document.createElement('a');link.href=url;link.download=data.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(loading && !account) return <div className="p-6 text-muted-foreground">Loading reporting…</div>;
  if(error) return <div className="p-6 space-y-3"><p className="text-destructive">{error}</p><Button onClick={()=>void load()}>Try again</Button></div>;
  if(!canAccess) return <div className="p-6"><h2 className="text-xl font-semibold">Access denied</h2><p className="text-muted-foreground">Reporting is available to management and accounts staff.</p></div>;
  return <div className="p-4 md:p-6 space-y-6 max-w-6xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Reporting & invoices</h1><Button variant="outline" onClick={()=>{setAccount({...defaults});setSummary(null);}}><Plus className="mr-2 h-4 w-4"/>New account</Button></div>
    <div className="flex flex-wrap gap-3 items-center"><Label htmlFor="report-account">Ledger account</Label><Select value={account?.id??''} onValueChange={id=>{setAccount(accounts.find(a=>a.id===id)??null);setSummary(null);}}><SelectTrigger id="report-account" className="w-64"><SelectValue placeholder="Choose account"/></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id??''}>{a.name}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" title="Refresh reporting" disabled={busy} onClick={()=>void load()}><RefreshCw className="h-4 w-4"/></Button>{account&&<Badge variant="secondary">{account.enabled?'Automatic email on':'Automatic email off'}</Badge>}</div>
    {!account?<div className="border-t pt-6 text-muted-foreground">No reporting accounts yet.</div>:<Tabs defaultValue="reports">
      <TabsList><TabsTrigger value="reports">Sales reports</TabsTrigger><TabsTrigger value="settings">Templates & schedule</TabsTrigger><TabsTrigger value="ledger">Ledger & payments</TabsTrigger></TabsList>
      <TabsContent value="settings" className="space-y-5 pt-4">
        <div className="grid md:grid-cols-2 gap-4"><div><Label>Account name</Label><Input maxLength={160} value={account.name} onChange={e=>update('name',e.target.value)}/></div><div><Label>Recipient email</Label><Input type="email" maxLength={254} value={account.recipient_email} onChange={e=>update('recipient_email',e.target.value)}/></div><div><Label>CC email (optional)</Label><Input type="email" maxLength={254} placeholder="e.g. accounts@buyawarranty.co.uk" value={account.cc_email} onChange={e=>update('cc_email',e.target.value)}/></div><div><Label>Head office charge (%) of total sales</Label><Input type="number" min={0} max={100} step={0.01} value={account.commission_pct} onChange={e=>update('commission_pct',Number(e.target.value))}/></div><div><Label>Invoice VAT (%)</Label><Input type="number" min={0} max={100} step={0.01} value={account.vat_pct} onChange={e=>update('vat_pct',Number(e.target.value))}/></div><div><Label>Invoice from</Label><Textarea maxLength={3000} value={account.invoice_from} onChange={e=>update('invoice_from',e.target.value)}/></div><div><Label>Invoice to</Label><Textarea maxLength={3000} value={account.invoice_to} onChange={e=>update('invoice_to',e.target.value)}/></div></div>
        <div><Label>Sales included</Label><Select value={account.sales_source} onValueChange={v=>update('sales_source',v)}><SelectTrigger className="max-w-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All sales</SelectItem><SelectItem value="website">Direct website sales (every source)</SelectItem><SelectItem value="agent">Agent-entered sales</SelectItem></SelectContent></Select></div>
        <div><Label>Email subject</Label><Input maxLength={500} value={account.email_subject} onChange={e=>update('email_subject',e.target.value)}/></div><div><Label>Email template</Label><Textarea rows={4} maxLength={10000} value={account.email_body} onChange={e=>update('email_body',e.target.value)}/><p className="text-xs text-muted-foreground mt-1">{'{{period}} · {{sales}} · {{commission}} · {{total}} · {{invoice}}'}</p></div><div><Label>Word report introduction</Label><Textarea maxLength={10000} value={account.document_intro} onChange={e=>update('document_intro',e.target.value)}/></div><div><Label>Invoice payment details and terms</Label><Textarea maxLength={3000} value={account.payment_details} onChange={e=>update('payment_details',e.target.value)}/></div>
        <div className="border-t pt-4 space-y-4"><div className="flex items-center gap-3"><Switch id="auto-report" checked={account.enabled} onCheckedChange={v=>update('enabled',v)}/><Label htmlFor="auto-report">Automatic email delivery</Label></div><div className="flex flex-wrap gap-4"><div><Label>Frequency</Label><Select value={account.frequency} onValueChange={v=>update('frequency',v)}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{account.frequency==='weekly'&&<div><Label>Day</Label><Select value={String(account.weekday)} onValueChange={v=>update('weekday',Number(v))}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>}{account.frequency==='monthly'&&<div><Label>Day of month</Label><Input className="w-32" type="number" min={1} max={28} value={account.monthday} onChange={e=>update('monthday',Number(e.target.value))}/></div>}<div><Label>London time</Label><Select value={String(account.send_hour)} onValueChange={v=>update('send_hour',Number(v))}><SelectTrigger className="w-32"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:24},(_,i)=><SelectItem key={i} value={String(i)}>{String(i).padStart(2,'0')}:00</SelectItem>)}</SelectContent></Select></div></div>{account.next_send_at&&<p className="text-sm text-muted-foreground">Next delivery: {new Date(account.next_send_at).toLocaleString('en-GB',{timeZone:'Europe/London'})} London</p>}{account.last_error&&<p className="text-destructive">Last delivery failed: {account.last_error}</p>}</div>
        <Button disabled={busy} onClick={()=>void run(save)}><Save className="mr-2 h-4 w-4"/>Save account and settings</Button>
      </TabsContent>
      <TabsContent value="reports" className="pt-4 space-y-5"><div className="flex flex-wrap gap-3 items-end"><div><Label>From</Label><Input type="date" value={from} onChange={e=>{setFrom(e.target.value);setSummary(null);}}/></div><div><Label>To</Label><Input type="date" value={to} onChange={e=>{setTo(e.target.value);setSummary(null);}}/></div><Button variant="outline" disabled={busy||!account.id} onClick={()=>void run(async()=>{const data=await invoke({action:'preview',accountId:account.id,from,to});setSummary(data.snapshot);})}><Eye className="mr-2 h-4 w-4"/>Preview totals</Button><Button disabled={busy||!account.id} onClick={()=>void run(async()=>{await invoke({action:'create',accountId:account.id,from,to,requestId:crypto.randomUUID()});await load();toast.success('Invoice created — no email sent');})}><Receipt className="mr-2 h-4 w-4"/>Create report & invoice</Button></div>
        {summary&&<div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-y py-5">{[['Sales',`${summary.salesCount} · ${money(summary.salesTotal)}`],['Head office charge',money(summary.commission)],['VAT',money(summary.vat)],['Invoice total',money(summary.total)]].map(([label,value])=><div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}</div>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="py-3">Invoice</th><th>Period</th><th>Total</th><th>Email</th><th className="text-right">Word documents</th></tr></thead><tbody>{selectedInvoices.map(i=><tr key={i.id} className="border-b"><td className="py-3 font-medium">{i.invoice_number}</td><td>{i.period_from} – {i.period_to}</td><td>{money(Number(i.total))}</td><td><Badge variant="secondary">{i.email_status.replaceAll('_',' ')}</Badge>{i.email_error&&<p className="text-xs text-destructive max-w-48">{i.email_error}</p>}</td><td><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(()=>download(i,'report'))}><Download className="mr-1 h-4 w-4"/>Report</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(()=>download(i,'invoice'))}><Download className="mr-1 h-4 w-4"/>Invoice</Button><Button size="icon" variant="ghost" title="Send report and invoice by email" disabled={busy||i.email_status==='sent'||i.email_status==='sending'} onClick={()=>setSendConfirm(i)}><Send className="h-4 w-4"/></Button></div></td></tr>)}</tbody></table>{!selectedInvoices.length&&<p className="py-6 text-muted-foreground">No saved reports or invoices for this account.</p>}</div>
      </TabsContent>
      <TabsContent value="ledger" className="pt-4 space-y-5"><div className="border-y py-5"><p className="text-sm text-muted-foreground">Outstanding balance</p><p className="text-3xl font-semibold">{money(outstanding)}</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left border-b"><tr><th className="py-3">Invoice</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th/></tr></thead><tbody>{selectedInvoices.map(i=><tr className="border-b" key={i.id}><td className="py-3">{i.invoice_number}</td><td>{money(Number(i.total))}</td><td>{money(paid(i.id))}</td><td>{money(Number(i.total)-paid(i.id))}</td><td className="text-right"><Button variant="outline" size="sm" disabled={busy||Number(i.total)<=paid(i.id)} onClick={()=>{setPaymentInvoice(i);setPaymentAmount('');setPaymentRef('');}}>Record payment</Button></td></tr>)}</tbody></table></div><h3 className="font-semibold">Payment history</h3>{payments.filter(p=>selectedInvoices.some(i=>i.id===p.invoice_id)).map(p=><div key={p.id} className="flex flex-wrap justify-between border-b py-2 gap-2 text-sm"><span>{p.paid_on} · {invoices.find(i=>i.id===p.invoice_id)?.invoice_number} · {p.reference}</span><span>{money(Number(p.amount))}</span></div>)}</TabsContent>
    </Tabs>}
    <Dialog open={!!paymentInvoice} onOpenChange={v=>{if(!v)setPaymentInvoice(null);}}><DialogContent><DialogHeader><DialogTitle>Record payment · {paymentInvoice?.invoice_number}</DialogTitle></DialogHeader><Label>Amount received (£)</Label><Input type="number" min={0.01} step={0.01} value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/><Label>Payment date</Label><Input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/><Label>Payment reference</Label><Input maxLength={250} value={paymentRef} onChange={e=>setPaymentRef(e.target.value)}/><Button disabled={busy} onClick={()=>void run(async()=>{if(!paymentInvoice)return;const {error}=await supabase.rpc('reporting_record_payment',{_invoice:paymentInvoice.id,_amount:Number(paymentAmount),_paid_on:paymentDate,_reference:paymentRef});if(error)throw error;setPaymentInvoice(null);await load();toast.success('Payment recorded');})}>Save payment</Button></DialogContent></Dialog>
    <Dialog open={!!sendConfirm} onOpenChange={v=>{if(!v)setSendConfirm(null);}}><DialogContent><DialogHeader><DialogTitle>Send report and invoice?</DialogTitle></DialogHeader><p>{sendConfirm?.invoice_number} · {account?.recipient_email||'No recipient email configured'}{account?.cc_email?` · CC ${account.cc_email}`:''}</p><Button disabled={busy||!account?.recipient_email} onClick={()=>void run(async()=>{if(!sendConfirm)return;await invoke({action:'send',invoiceId:sendConfirm.id});setSendConfirm(null);await load();toast.success('Report and invoice sent');})}><Send className="mr-2 h-4 w-4"/>Confirm email delivery</Button></DialogContent></Dialog>
  </div>;
}