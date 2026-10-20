import { useEffect, useState } from 'react';
import { Check, X, Bell, Save, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Proposal = { id: string; title: string; category: string; page_url: string; evidence: string; proposed_change: string; verification: string; priority: string; decision: string };
type Run = { id: string; audit_week: string; status: string; report: { checkedAt?: string; checkedPages?: number; sitemapPages?: number; gaps?: string[]; limitations?: string[]; google?: unknown; backlinks?: unknown; pages?: unknown[]; robots?: unknown } };
type Config = { is_super_admin: boolean; settings: { seo_admin_id: string | null; site_url: string | null }; staff: { id: string; name: string; email: string }[] };

export function SeoActionGuide() {
  return <section className="border-b border-border pb-4 space-y-2 text-sm">
    <h3 className="font-semibold">Who does what?</h3>
    <ol className="list-decimal pl-5 space-y-2">
      <li><strong>Agentic Assistant proposes:</strong> it reviews saved evidence and recommends work. Words such as “update” or “review” describe suggested work, not work already done.</li>
      <li><strong>A super admin decides:</strong> “Authorise” records approval only. “Reject” records that the suggestion is declined. Neither button changes the website.</li>
      <li><strong>You request the work:</strong> after authorisation, ask Lovable in your project chat to implement the specific recommendation in preview, or assign it to your website editor. You do not need to edit it yourself. This CRM assistant cannot edit pages, and no button here starts implementation.</li>
      <li><strong>You check and separately approve publication:</strong> review the prepared change first, then explicitly request publication or deploy it through your normal website process. Authorisation does not make it live.</li>
      <li><strong>The published page is checked afterwards:</strong> a subsequent review, or a separate verification request, checks the live result. Authorised status alone is not evidence that a fix is complete.</li>
    </ol>
    <p className="text-muted-foreground"><strong>Priority:</strong> High = review first; Medium = review after high-priority items; Low = lower-priority opportunity. Priority is not a deadline, an approval, or proof of a ranking problem.</p>
  </section>;
}

export function SeoProposalDetails({ proposal }: { proposal: Proposal }) {
  const status = proposal.decision === 'approved' ? 'Authorised · awaiting implementation request' : proposal.decision === 'rejected' ? 'Rejected · no work requested' : 'Awaiting super-admin decision';
  return <>
    <div className="flex flex-wrap items-center gap-2"><Badge variant={proposal.priority === 'High' ? 'destructive' : 'secondary'}>Priority: {proposal.priority}</Badge><Badge variant="outline">{status}</Badge><h3 className="font-semibold">{proposal.title}</h3></div>
    <a href={proposal.page_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm break-all">{proposal.page_url}</a>
    <p className="text-sm whitespace-pre-wrap"><strong>What the saved review found: </strong>{proposal.evidence}</p>
    <p className="text-sm"><strong>Suggested work — not performed by this page: </strong>{proposal.proposed_change}</p>
    <p className="text-sm"><strong>Who acts next: </strong>{proposal.decision === 'approved' ? 'You or your SEO colleague must request this specific work in Lovable project chat, or assign it to your website editor. Approval has been recorded; this page has not implemented or published the change.' : proposal.decision === 'rejected' ? 'No implementation is requested for this suggestion.' : 'A super admin must review the evidence and authorise or reject the suggestion. The SEO colleague can review it but cannot authorise it here.'}</p>
    <p className="text-sm text-muted-foreground"><strong>Check after implementation and separate publication: </strong>{proposal.verification}</p>
  </>;
}

export default function WeeklySeoReviews() {
  const [config, setConfig] = useState<Config | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState('');
  const [recipient, setRecipient] = useState('none');
  const [property, setProperty] = useState('none');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const [configuration, reports] = await Promise.all([supabase.rpc('seo_review_configuration'), supabase.from('seo_review_runs').select('*').order('audit_week', { ascending: false }).limit(52)]);
    if (configuration.error) { setError(configuration.error.message); setLoading(false); return; }
    if (reports.error) { setError(reports.error.message); setLoading(false); return; }
    const value = configuration.data as unknown as Config;
    setConfig(value); setRecipient(value.settings.seo_admin_id || 'none'); setProperty(value.settings.site_url || 'none');
    setRuns(reports.data as unknown as Run[]); setSelected(prev => prev || reports.data?.[0]?.id || ''); setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void supabase.from('seo_review_proposals').select('*').eq('run_id', selected).order('created_at').then(({ data, error }) => { if (!active) return; if (error) setError(error.message); else setProposals(data || []); });
    return () => { active = false; };
  }, [selected]);
  const run = runs.find(row => row.id === selected);
  const save = async () => {
    setBusy(true); setError('');
    const { error } = await supabase.rpc('configure_seo_reviews', { p_seo_admin_id: recipient === 'none' ? null : recipient, p_site_url: property === 'none' ? null : property });
    if (error) setError(error.message); else await load();
    setBusy(false);
  };
  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(true); setError('');
    const { error } = await supabase.rpc('decide_seo_proposal', { p_id: id, p_decision: decision, p_note: note });
    if (error) setError(error.message); else setProposals(rows => rows.map(row => row.id === id ? { ...row, decision } : row));
    setBusy(false);
  };
  const authoriseAll = async () => {
    const pending = proposals.filter(p => p.decision === 'pending');
    if (!pending.length || !confirm(`Record approval for all ${pending.length} pending proposals? This does not start work, change pages or publish anything. You must separately request implementation in Lovable project chat or assign your website editor.`)) return;
    setBusy(true); setError('');
    const done: string[] = [];
    for (const p of pending) {
      const { error } = await supabase.rpc('decide_seo_proposal', { p_id: p.id, p_decision: 'approved', p_note: note });
      if (error) { setError(error.message); break; }
      done.push(p.id);
    }
    setProposals(rows => rows.map(row => done.includes(row.id) ? { ...row, decision: 'approved' } : row));
    setBusy(false);
  };
  const properties = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('weekly-seo-review', { body: { action: 'properties' } });
    if (error) { const context = (error as { context?: Response }).context; setError(context ? await context.text() : error.message); } else setCandidates(data.candidates || []);
    setBusy(false);
  };
  if (loading) return <p className="text-muted-foreground">Loading weekly reviews…</p>;
  if (!config) return <p className="text-muted-foreground">Weekly reviews are private to super admins and the selected SEO staff account.</p>;
  return <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-6">
    <header className="border-b border-border pb-4 space-y-2"><h2 className="text-lg font-semibold">Weekly reviews and authorisations</h2><p className="text-sm text-muted-foreground">Mondays, 09:00 UTC · Published website only · No automatic changes or publishing</p><p className="text-sm">Reminders: active super admins{recipient !== 'none' ? ' and the selected SEO staff account' : ' only — SEO recipient not selected yet'}.</p></header>
    <SeoActionGuide />
    {error && <p role="alert" className="text-destructive text-sm break-words">{error}</p>}
    {config.is_super_admin && <section className="space-y-3 border-b border-border pb-5">
      <h3 className="font-semibold">Private review recipients</h3>
      <Select value={recipient} onValueChange={setRecipient}><SelectTrigger className="max-w-lg" aria-label="SEO staff recipient"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Select SEO staff account</SelectItem>{config.staff.map(staff => <SelectItem key={staff.id} value={staff.id}>{staff.name} · {staff.email}</SelectItem>)}</SelectContent></Select>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={properties} disabled={busy}><ExternalLink className="h-4 w-4 mr-2" />Load verified Google properties</Button>{candidates.length > 0 && <Select value={property} onValueChange={setProperty}><SelectTrigger className="max-w-lg" aria-label="Verified Google property"><SelectValue placeholder="Choose a verified property" /></SelectTrigger><SelectContent><SelectItem value="none">Choose a verified property</SelectItem>{candidates.map(site => <SelectItem key={site} value={site}>{site}</SelectItem>)}</SelectContent></Select>}<Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />Save recipients and Google property</Button></div>
      <p className="text-xs text-muted-foreground">“Load” lists available verified Google properties. “Save” changes only the review recipient and selected Google property, not website pages. Google checks pause if several properties match until you select one.</p>
    </section>}
    {runs.length > 0 ? <Select value={selected} onValueChange={setSelected}><SelectTrigger className="max-w-md" aria-label="Weekly review"><SelectValue /></SelectTrigger><SelectContent>{runs.map(row => <SelectItem key={row.id} value={row.id}>Week of {row.audit_week} · {row.status}</SelectItem>)}</SelectContent></Select> : <p className="text-muted-foreground">The first scheduled review has not completed yet.</p>}
    {run && <><div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{run.status}</Badge><span className="text-sm">{run.report.checkedPages ?? 0} / {run.report.sitemapPages ?? 0} sitemap pages checked</span><span className="text-sm text-muted-foreground">{run.report.checkedAt ? new Date(run.report.checkedAt).toLocaleString('en-GB') : 'Awaiting review'}</span></div>
      <details className="border-b border-border pb-4"><summary className="cursor-pointer font-medium">Evidence and coverage gaps</summary><ul className="list-disc pl-5 py-3 space-y-2 text-sm">{[...(run.report.gaps || []), ...(run.report.limitations || [])].map((gap, index) => <li key={index}>{gap}</li>)}</ul><details><summary className="cursor-pointer text-sm">Google performance evidence</summary><pre className="whitespace-pre-wrap break-all text-xs py-3">{JSON.stringify(run.report.google ?? 'Not available for this review', null, 2)}</pre></details><details><summary className="cursor-pointer text-sm">Semrush backlink evidence</summary><pre className="whitespace-pre-wrap break-all text-xs py-3">{JSON.stringify(run.report.backlinks ?? 'Not available for this review', null, 2)}</pre></details><details><summary className="cursor-pointer text-sm">Pages and crawler access evidence</summary><pre className="whitespace-pre-wrap break-all text-xs py-3">{JSON.stringify({ pages: run.report.pages, robots: run.report.robots }, null, 2)}</pre></details></details>
      {config.is_super_admin && <Textarea aria-label="Authorisation note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="Optional review note…" />}
      {config.is_super_admin && proposals.some(p => p.decision === 'pending') && <div className="space-y-2"><Button className="h-auto whitespace-normal text-left" disabled={busy} onClick={authoriseAll}><Check className="h-4 w-4 mr-2 shrink-0" />Authorise all pending — record approval only ({proposals.filter(p => p.decision === 'pending').length})</Button><p className="text-xs text-muted-foreground">Records your decisions and optional note only. It does not instruct Lovable or your editor to begin work.</p></div>}
      <div className="divide-y divide-border">{proposals.map(proposal => <article key={proposal.id} className="py-5 space-y-3"><SeoProposalDetails proposal={proposal} />{config.is_super_admin && proposal.decision === 'pending' && <div className="flex flex-wrap gap-2"><Button className="h-auto whitespace-normal text-left" disabled={busy} onClick={() => decide(proposal.id, 'approved')}><Check className="h-4 w-4 mr-2 shrink-0" />Authorise — record approval only</Button><Button disabled={busy} variant="outline" onClick={() => decide(proposal.id, 'rejected')}><X className="h-4 w-4 mr-2" />Reject suggestion</Button></div>}</article>)}</div>
      {!proposals.length && <p className="text-muted-foreground"><Bell className="inline h-4 w-4 mr-2" />No proposals recorded for this review. Check coverage before drawing conclusions.</p>}
    </>}
  </div>;
}