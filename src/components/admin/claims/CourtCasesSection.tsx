import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, Plus, ChevronDown, ChevronRight, ExternalLink, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export const COURT_CASE_TYPES: { value: string; label: string }[] = [
  { value: 'mediation', label: 'Mediation' },
  { value: 'ombudsman', label: 'Ombudsman / ADR' },
  { value: 'small_claims', label: 'UK Small Claims Court' },
  { value: 'county_court', label: 'County Court claim' },
  { value: 'high_court', label: 'High Court claim' },
  { value: 'court_appeal', label: 'Court appeal' },
  { value: 'letter_before_action', label: 'Letter before action' },
  { value: 'defence_counterclaim', label: 'Defence / counterclaim' },
  { value: 'enforcement', label: 'Enforcement (CCJ)' },
];
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_paperwork', label: 'Paperwork due' },
  { value: 'hearing_listed', label: 'Hearing listed' },
  { value: 'settled', label: 'Settled' },
  { value: 'won', label: 'Closed — won' },
  { value: 'lost', label: 'Closed — lost' },
  { value: 'withdrawn', label: 'Withdrawn' },
];
const CLOSED = new Set(['settled', 'won', 'lost', 'withdrawn']);

interface CourtCase {
  id: string; case_type: string; registration: string; customer_name: string | null;
  case_reference: string | null; claim_file_url: string | null; paperwork_deadline: string | null;
  hearing_date: string | null; status: string; notes: string | null; created_at: string;
}

const typeLabel = (v: string) => COURT_CASE_TYPES.find(t => t.value === v)?.label || v;
const statusLabel = (v: string) => STATUSES.find(t => t.value === v)?.label || v;
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (d: string) => {
  const t = new Date(d + 'T00:00:00'); const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / 86400000);
};

export const DeadlineTag: React.FC<{ date: string | null; closed?: boolean }> = ({ date, closed }) => {
  if (!date) return <span className="text-slate-400">—</span>;
  if (closed) return <span className="text-slate-500">{fmt(date)}</span>;
  const d = daysUntil(date);
  const [txt, cls] = d < 0 ? [`${-d}d overdue`, 'bg-red-600 text-white border-red-700']
    : d === 0 ? ['Due today', 'bg-red-100 text-red-800 border-red-300']
    : d <= 7 ? [`Due in ${d}d`, 'bg-orange-100 text-orange-800 border-orange-300']
    : d <= 30 ? [`Due in ${d}d`, 'bg-amber-50 text-amber-800 border-amber-300']
    : [`Due in ${d}d`, 'bg-slate-100 text-slate-700 border-slate-300'];
  return (
    <span className="inline-flex items-center gap-2">
      <span>{fmt(date)}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{txt}</span>
    </span>
  );
};

export function useCourtCases() {
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('claim_court_cases').select('*')
      .order('paperwork_deadline', { ascending: true, nullsFirst: false }).limit(500);
    if (!error) setCases(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { cases, loading, reload: load };
}

/** Banner for the top of Claims — shows paperwork deadlines due within 14 days or overdue. */
export const CourtDeadlinesBanner: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { cases } = useCourtCases();
  const due = cases.filter(c => c.paperwork_deadline && !CLOSED.has(c.status) && daysUntil(c.paperwork_deadline) <= 14);
  if (due.length === 0) return null;
  const overdue = due.filter(c => daysUntil(c.paperwork_deadline!) < 0).length;
  const next = due[0];
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 flex items-center gap-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
      <span className="font-semibold text-red-800">
        Court paperwork due: {due.length} case{due.length === 1 ? '' : 's'} within 14 days
        {overdue > 0 ? ` — ${overdue} overdue` : ''}
      </span>
      <span className="text-red-700 hidden md:inline">
        · Next: {next.registration} ({typeLabel(next.case_type)}) {fmt(next.paperwork_deadline)}
      </span>
      <Button size="sm" variant="outline" className="ml-auto h-7" onClick={onOpen}>View court cases</Button>
    </div>
  );
};

const empty = { case_type: 'small_claims', registration: '', customer_name: '', case_reference: '', claim_file_url: '', paperwork_deadline: '', hearing_date: '', status: 'open', notes: '' };

export const CourtCasesSection: React.FC = () => {
  const { cases, loading, reload } = useCourtCases();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (c: CourtCase) => {
    setEditId(c.id);
    setForm({ case_type: c.case_type, registration: c.registration, customer_name: c.customer_name || '', case_reference: c.case_reference || '', claim_file_url: c.claim_file_url || '', paperwork_deadline: c.paperwork_deadline || '', hearing_date: c.hearing_date || '', status: c.status, notes: c.notes || '' });
    setOpen(true);
  };

  const save = async () => {
    const reg = form.registration.replace(/\s+/g, '').toUpperCase();
    if (!reg) { toast.error('Enter the registration plate'); return; }
    let url = form.claim_file_url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    let claim_id: string | null = null;
    const { data: claim } = await supabase.from('claims_submissions').select('id, name').ilike('vehicle_registration', reg).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (claim) claim_id = (claim as any).id;
    const payload: any = {
      case_type: form.case_type, registration: reg,
      customer_name: form.customer_name.trim() || (claim as any)?.name || null,
      case_reference: form.case_reference.trim() || null, claim_file_url: url || null,
      paperwork_deadline: form.paperwork_deadline || null, hearing_date: form.hearing_date || null,
      status: form.status, notes: form.notes.trim() || null, claim_id,
    };
    const q = editId
      ? (supabase as any).from('claim_court_cases').update(payload).eq('id', editId)
      : (supabase as any).from('claim_court_cases').insert({ ...payload, created_by: u.user?.id });
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error('Could not save: ' + error.message); return; }
    toast.success(editId ? 'Court case updated' : 'Court case registered');
    setOpen(false); reload();
  };

  const openCount = cases.filter(c => !CLOSED.has(c.status)).length;
  const visible = showAll ? cases : cases.slice(0, 5);

  return (
    <div className="rounded-xl border border-indigo-200 bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-indigo-50/60 border-b border-indigo-200">
        <div className="h-8 w-8 rounded-md bg-indigo-100 flex items-center justify-center"><Landmark className="h-4 w-4 text-indigo-700" /></div>
        <div>
          <div className="font-semibold text-indigo-900">Court cases</div>
          <div className="text-xs text-indigo-700">Mediation, Small Claims Court, appeals and other court cases, with paperwork deadlines</div>
        </div>
        <span className="ml-auto rounded-full bg-indigo-600 text-white text-xs font-bold px-3 py-1">{openCount} open</span>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Register court case</Button>
      </div>

      <div className="p-4">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : cases.length === 0 ? (
          <div className="text-sm text-muted-foreground">No court cases yet. Use "Register court case" to add one by registration plate.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[24px_1.4fr_1fr_1.2fr_1.6fr_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span /> <span>Case type</span><span>Reg</span><span>Customer</span><span>Paperwork deadline</span><span>Status</span>
            </div>
            {visible.map(c => {
              const isOpen = expanded === c.id; const closed = CLOSED.has(c.status);
              return (
                <div key={c.id} className="border-t">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full grid grid-cols-[24px_1.4fr_1fr_1.2fr_1.6fr_1fr] gap-2 px-3 py-2.5 text-sm text-left items-center hover:bg-muted/40">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{typeLabel(c.case_type)}</span>
                    <span className="font-bold">{c.registration}</span>
                    <span className="truncate">{c.customer_name || '—'}</span>
                    <DeadlineTag date={c.paperwork_deadline} closed={closed} />
                    <span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${closed ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-amber-100 border-amber-300 text-amber-800'}`}>{statusLabel(c.status)}</span></span>
                  </button>
                  {isOpen && (
                    <div className="px-10 pb-3 pt-1 grid md:grid-cols-3 gap-3 text-sm bg-muted/20">
                      <div><div className="text-xs text-muted-foreground">Case reference</div>{c.case_reference || '—'}</div>
                      <div><div className="text-xs text-muted-foreground">Hearing date</div>{fmt(c.hearing_date)}</div>
                      <div><div className="text-xs text-muted-foreground">Registered</div>{fmt(c.created_at)}</div>
                      <div className="md:col-span-2"><div className="text-xs text-muted-foreground">Original claim file</div>
                        {c.claim_file_url ? <a href={c.claim_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline break-all">Open claim file <ExternalLink className="h-3.5 w-3.5" /></a> : '—'}
                      </div>
                      <div className="md:text-right"><Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit / update status</Button></div>
                      {c.notes && <div className="md:col-span-3"><div className="text-xs text-muted-foreground">Notes</div><div className="whitespace-pre-wrap">{c.notes}</div></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {cases.length > 5 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show fewer' : `Show all ${cases.length} cases`}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Update court case' : 'Register court case'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Case type</Label>
              <Select value={form.case_type} onValueChange={v => setForm(f => ({ ...f, case_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COURT_CASE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Registration plate *</Label><Input value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value.toUpperCase() }))} placeholder="AB12 CDE" /></div>
              <div><Label>Customer name</Label><Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Filled from claim if blank" /></div>
            </div>
            <div><Label>Link to original claim file</Label><Input value={form.claim_file_url} onChange={e => setForm(f => ({ ...f, claim_file_url: e.target.value }))} placeholder="https://…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Court / case reference</Label><Input value={form.case_reference} onChange={e => setForm(f => ({ ...f, case_reference: e.target.value }))} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Paperwork deadline</Label><Input type="date" value={form.paperwork_deadline} onChange={e => setForm(f => ({ ...f, paperwork_deadline: e.target.value }))} /></div>
              <div><Label>Hearing date</Label><Input type="date" value={form.hearing_date} onChange={e => setForm(f => ({ ...f, hearing_date: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
