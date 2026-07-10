import React, { useState } from 'react';
import { X, AlertOctagon, AlertCircle, FileText, MessageSquare, Phone, DollarSign, Scale, History, Paperclip, Save, Upload, PhoneCall, Edit3, ArrowLeft } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ClaimNotesPanel } from '@/components/admin/claims/ClaimNotesPanel';
import { ClaimCommunicationsPanel } from '@/components/admin/claims/ClaimCommunicationsPanel';
import { ClaimAttachmentsPanel } from './ClaimAttachmentsPanel';
import { ClaimStatusDropdown } from '@/components/admin/claims/ClaimStatusDropdown';
import { RequestUpdateDialog } from '@/components/admin/claims/RequestUpdateDialog';
import {
  useSettlement, useClaimCallLogs, useClaimDocuments, useClaimAppeal, useClaimAudit,
  updateClaimField, logClaimAudit,
} from '@/hooks/useClaimWorkspace';
import { formatDaysOnRisk } from './formatters';

interface Props {

  claim: Claim;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
}

const fmtGBP = (n?: number | null) => n == null || !Number.isFinite(Number(n)) ? '—' : `£${Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const PRIORITIES = ['normal', 'high', 'critical'] as const;
const priorityColor = (p: string) => p === 'critical' ? 'bg-red-100 text-red-800 border-red-300' : p === 'high' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300';

export const ClaimWorkspace: React.FC<Props> = ({ claim, onClose, onUpdated }) => {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [priorityDialog, setPriorityDialog] = useState(false);
  const [callDialog, setCallDialog] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [mileageEdit, setMileageEdit] = useState(false);
  const [garageEdit, setGarageEdit] = useState(false);
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [notesKey, setNotesKey] = useState(0);

  const refetch = async () => { if (onUpdated) await onUpdated(); };

  const handleStatusChanged = async ({ fromStatus, toStatus, toLabel }: { fromStatus: string; toStatus: string; toLabel: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: adminData } = await supabase.from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminData?.id) return;
      await supabase.from('claim_quick_notes').insert({
        claim_id: claim.id,
        note_text: `Status changed: ${fromStatus || '—'} → ${toLabel}`,
        created_by: adminData.id,
      });
      setNotesKey(k => k + 1);
    } catch (e) {
      console.error('Failed to log status-change note', e);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to claims
          </button>
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
              {initials(claim.customerName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-foreground truncate">{claim.customerName}</h1>
                <span className="bg-yellow-400 border border-black px-2 py-0.5 rounded text-xs font-black tracking-wide" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
                  {claim.reg}
                </span>
                <Badge variant="outline" className={cn('text-xs cursor-pointer', priorityColor(claim.priority))} onClick={() => setPriorityDialog(true)}>
                  {claim.priority.toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                BAW-{claim.reg} · Opened {claim.date} · {claim.ageInDays}d open · Assigned {claim.assignee}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ClaimStatusDropdown claimId={claim.id} currentTagId={undefined} currentStatus={claim.rawStatus || 'new'} onUpdate={refetch} onStatusChanged={handleStatusChanged} />
              <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Primary action bar */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEvidenceDialog(true)}><FileText className="h-3.5 w-3.5 mr-1.5" /> Request evidence</Button>
            <Button size="sm" variant="outline" onClick={() => setCallDialog(true)}><PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Log call</Button>
            <Button size="sm" variant="outline" onClick={() => setUploadDialog(true)}><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload document</Button>
            <Button size="sm" variant="outline" onClick={() => setTab('notes')}><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Add note</Button>
            <Button size="sm" variant="outline" onClick={() => setTab('settlement')}><DollarSign className="h-3.5 w-3.5 mr-1.5" /> Settlement</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 space-y-4">
        {/* Complaint banner */}
        {claim.complaint && (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-red-800">Complaint submitted</div>
              <div className="text-xs text-red-700 mt-0.5">
                Ref <span className="font-mono">{claim.complaint.reference}</span> · {claim.complaint.category} ·{' '}
                {new Date(claim.complaint.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {/* Summary card */}
        <SummaryCard claim={claim} onEditMileage={() => setMileageEdit(true)} onEditGarage={() => setGarageEdit(true)} />

        {/* Notes & activity timeline (always visible, at top) */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Notes & activity</h3>
            <span className="text-xs text-muted-foreground">Newest first · status changes auto-logged</span>
          </div>
          <ClaimNotesPanel key={notesKey} claimId={claim.id} />
        </div>


        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 h-auto bg-brand-orange-lighter p-1">
            <TabsTrigger value="overview" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><AlertCircle className="h-3.5 w-3.5 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><Paperclip className="h-3.5 w-3.5 mr-1" /> Documents</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Notes</TabsTrigger>
            <TabsTrigger value="comms" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><FileText className="h-3.5 w-3.5 mr-1" /> Comms</TabsTrigger>
            <TabsTrigger value="calls" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><Phone className="h-3.5 w-3.5 mr-1" /> Calls</TabsTrigger>
            <TabsTrigger value="settlement" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><DollarSign className="h-3.5 w-3.5 mr-1" /> Settlement</TabsTrigger>
            <TabsTrigger value="appeal" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><Scale className="h-3.5 w-3.5 mr-1" /> Appeal</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs text-black data-[state=active]:bg-white data-[state=active]:text-black"><History className="h-3.5 w-3.5 mr-1" /> Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold">Reported issue</span>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{claim.issue || '—'}</p>
              <div className="pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><div className="text-muted-foreground">Days on risk</div><div className="font-semibold">{formatDaysOnRisk(claim.daysOnRisk)}</div></div>
                <div><div className="text-muted-foreground">Days open</div><div className="font-semibold">{claim.ageInDays}d</div></div>

                <div><div className="text-muted-foreground">Purchase mileage</div><div className="font-semibold">{claim.purchaseMileage != null ? claim.purchaseMileage.toLocaleString() : '—'}</div></div>
                <div><div className="text-muted-foreground">Claim mileage</div><div className="font-semibold">{claim.claimMileage != null ? claim.claimMileage.toLocaleString() : '—'}</div></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4 space-y-4">
            <ClaimAttachmentsPanel attachments={claim.attachments ?? []} claimId={claim.id} onUploaded={refetch} />
            <AgentDocumentsPanel claimId={claim.id} onOpenUpload={() => setUploadDialog(true)} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4"><ClaimNotesPanel claimId={claim.id} /></TabsContent>
          <TabsContent value="comms" className="mt-4"><ClaimCommunicationsPanel claimId={claim.id} /></TabsContent>
          <TabsContent value="calls" className="mt-4"><CallsPanel claimId={claim.id} onLog={() => setCallDialog(true)} /></TabsContent>
          <TabsContent value="settlement" className="mt-4"><SettlementPanel claim={claim} onSaved={refetch} /></TabsContent>
          <TabsContent value="appeal" className="mt-4"><AppealPanel claimId={claim.id} /></TabsContent>
          <TabsContent value="audit" className="mt-4"><AuditPanel claimId={claim.id} /></TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <PriorityDialog claim={claim} open={priorityDialog} onClose={() => setPriorityDialog(false)} onSaved={refetch} />
      <LogCallDialog claimId={claim.id} open={callDialog} onClose={() => setCallDialog(false)} />
      <UploadDocumentDialog claimId={claim.id} open={uploadDialog} onClose={() => setUploadDialog(false)} />
      <MileageEditDialog claim={claim} open={mileageEdit} onClose={() => setMileageEdit(false)} onSaved={refetch} />
      <GarageEditDialog claim={claim} open={garageEdit} onClose={() => setGarageEdit(false)} onSaved={refetch} />
      <RequestUpdateDialog
        claims={[{ id: claim.id, name: claim.customerName, vehicle_registration: claim.reg, claim_reason: claim.issue }]}
        open={evidenceDialog}
        onOpenChange={setEvidenceDialog}
        onSent={refetch}
      />
    </div>
  );
};

// ============= Summary card =============
const SummaryCard: React.FC<{ claim: Claim; onEditMileage: () => void; onEditGarage: () => void }> = ({ claim, onEditMileage, onEditGarage }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-xs">
      <Field label="Vehicle" value={[claim.vehicleMake, claim.vehicleModel].filter(Boolean).join(' ') || '—'} />
      <Field label="Registration" value={<span className="font-mono font-semibold">{claim.reg}</span>} />
      <Field label="Warranty start" value={claim.daysOnRisk != null ? `${formatDaysOnRisk(claim.daysOnRisk)} ago` : '—'} />
      <Field label="Claim limit" value={fmtGBP(claim.claimLimit)} />

      <Field label="Labour rate" value={claim.labourRate != null ? `${fmtGBP(claim.labourRate)}/hr` : '—'} />
      <Field label="Voluntary excess" value={fmtGBP(claim.voluntaryExcess)} />
      <Field label="Purchase mileage" value={claim.purchaseMileage != null ? claim.purchaseMileage.toLocaleString() : '—'} />
      <Field
        label={<span className="flex items-center gap-1">Claim mileage <button onClick={onEditMileage} className="text-primary hover:underline"><Edit3 className="h-3 w-3" /></button></span>}
        value={claim.claimMileage != null ? claim.claimMileage.toLocaleString() : '—'}
      />
      <Field label="Email" value={<span className="truncate">{claim.email || '—'}</span>} />
      <Field label="Phone" value={claim.phone || '—'} />
      <Field
        label={<span className="flex items-center gap-1">Garage <button onClick={onEditGarage} className="text-primary hover:underline"><Edit3 className="h-3 w-3" /></button></span>}
        value={<GarageDisplay claimId={claim.id} />}
      />
      <Field label="Plan" value={claim.tier || '—'} />
    </div>
  </div>
);

const Field: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
  <div><div className="text-muted-foreground mb-0.5">{label}</div><div className="font-medium text-foreground">{value}</div></div>
);

const GarageDisplay: React.FC<{ claimId: string }> = ({ claimId }) => {
  const [garage, setGarage] = useState<{ name?: string; phone?: string; email?: string }>({});
  React.useEffect(() => {
    supabase.from('claims_submissions').select('garage_name,garage_phone,garage_email').eq('id', claimId).maybeSingle()
      .then(({ data }) => setGarage({ name: (data as any)?.garage_name, phone: (data as any)?.garage_phone, email: (data as any)?.garage_email }));
  }, [claimId]);
  if (!garage.name && !garage.phone) return <span className="text-muted-foreground">—</span>;
  return <span>{garage.name || '—'}{garage.phone ? ` · ${garage.phone}` : ''}</span>;
};

// ============= Agent-uploaded documents =============
const AgentDocumentsPanel: React.FC<{ claimId: string; onOpenUpload: () => void }> = ({ claimId, onOpenUpload }) => {
  const { docs, loading, remove } = useClaimDocuments(claimId);
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Agent uploads</h3>
        <Button size="sm" variant="outline" onClick={onOpenUpload}><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload</Button>
      </div>
      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> :
        docs.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No agent uploads yet</div> :
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-3 p-2 border border-border rounded-md">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.label && <span className="mr-2">{d.label}</span>}
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">{d.visibility}</Badge>
                  <span className="ml-2">by {d.uploaded_by_name || 'Staff'} · {new Date(d.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
              <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
              <button onClick={() => remove(d.id)} className="text-xs text-destructive hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      }
    </div>
  );
};

// ============= Calls panel =============
const CallsPanel: React.FC<{ claimId: string; onLog: () => void }> = ({ claimId, onLog }) => {
  const { logs, loading } = useClaimCallLogs(claimId);
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Call log</h3>
        <Button size="sm" variant="outline" onClick={onLog}><PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Log call</Button>
      </div>
      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> :
        logs.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No calls logged yet</div> :
        <ul className="space-y-2">
          {logs.map(l => (
            <li key={l.id} className="p-3 border border-border rounded-md">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{l.called_party} {l.outcome && <Badge variant="outline" className="ml-2 text-[10px]">{l.outcome}</Badge>}</div>
                <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('en-GB')} · {l.logged_by_name || 'Staff'}</div>
              </div>
              {l.summary && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{l.summary}</p>}
              {l.follow_up_required && <div className="text-xs text-amber-700 mt-1">Follow-up: {l.follow_up_date || 'TBD'}</div>}
            </li>
          ))}
        </ul>
      }
    </div>
  );
};

// ============= Settlement panel =============
const SettlementPanel: React.FC<{ claim: Claim; onSaved: () => void }> = ({ claim, onSaved }) => {
  const { settlement, loading, save } = useSettlement(claim.id);
  const [form, setForm] = useState<any>({});
  React.useEffect(() => { if (settlement) setForm(settlement); }, [settlement]);
  const { toast } = useToast();

  const handle = async () => {
    try {
      await save({
        approved_amount: form.approved_amount ? Number(form.approved_amount) : null,
        excess_deducted: form.excess_deducted ? Number(form.excess_deducted) : null,
        final_paid_amount: form.final_paid_amount ? Number(form.final_paid_amount) : null,
        payment_date: form.payment_date || null,
        payment_method: form.payment_method || null,
        paid_to: form.paid_to || null,
        invoice_reference: form.invoice_reference || null,
        notes: form.notes || null,
      });
      // Also mirror final_paid_amount to claims_submissions.paid_amount for the Amount column
      if (form.final_paid_amount != null && form.final_paid_amount !== '') {
        await supabase.from('claims_submissions').update({ paid_amount: Number(form.final_paid_amount) }).eq('id', claim.id);
      }
      toast({ title: 'Settlement saved' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold">Decision & settlement</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Fld label="Approved amount (£)"><Input type="number" step="0.01" value={form.approved_amount ?? ''} onChange={e => setForm((f: any) => ({ ...f, approved_amount: e.target.value }))} /></Fld>
        <Fld label="Excess deducted (£)"><Input type="number" step="0.01" value={form.excess_deducted ?? ''} onChange={e => setForm((f: any) => ({ ...f, excess_deducted: e.target.value }))} /></Fld>
        <Fld label="Final paid (£)"><Input type="number" step="0.01" value={form.final_paid_amount ?? ''} onChange={e => setForm((f: any) => ({ ...f, final_paid_amount: e.target.value }))} /></Fld>
        <Fld label="Payment date"><Input type="date" value={form.payment_date ?? ''} onChange={e => setForm((f: any) => ({ ...f, payment_date: e.target.value }))} /></Fld>
        <Fld label="Payment method">
          <Select value={form.payment_method ?? ''} onValueChange={(v) => setForm((f: any) => ({ ...f, payment_method: v }))}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="direct_to_garage">Direct to garage</SelectItem>
            </SelectContent>
          </Select>
        </Fld>
        <Fld label="Paid to">
          <Select value={form.paid_to ?? ''} onValueChange={(v) => setForm((f: any) => ({ ...f, paid_to: v }))}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="garage">Garage</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Fld>
        <Fld label="Invoice reference"><Input value={form.invoice_reference ?? ''} onChange={e => setForm((f: any) => ({ ...f, invoice_reference: e.target.value }))} /></Fld>
      </div>
      <Fld label="Settlement notes"><Textarea rows={3} value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></Fld>
      <Button onClick={handle} size="sm"><Save className="h-3.5 w-3.5 mr-1.5" /> Save settlement</Button>
    </div>
  );
};

const Fld: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
);

// ============= Appeal panel =============
const AppealPanel: React.FC<{ claimId: string }> = ({ claimId }) => {
  const { appeal, loading, upsert } = useClaimAppeal(claimId);
  const [form, setForm] = useState<any>({ status: 'submitted' });
  React.useEffect(() => { if (appeal) setForm(appeal); }, [appeal]);

  if (loading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold">Appeal</h3>
      <Fld label="Appeal status">
        <Select value={form.status ?? 'submitted'} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="in_review">In review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </Fld>
      <Fld label="Appeal reason"><Textarea rows={3} value={form.reason ?? ''} onChange={e => setForm((f: any) => ({ ...f, reason: e.target.value }))} /></Fld>
      <Fld label="New evidence"><Textarea rows={3} value={form.new_evidence ?? ''} onChange={e => setForm((f: any) => ({ ...f, new_evidence: e.target.value }))} /></Fld>
      <Fld label="Outcome"><Textarea rows={2} value={form.outcome ?? ''} onChange={e => setForm((f: any) => ({ ...f, outcome: e.target.value }))} /></Fld>
      <Button size="sm" onClick={() => upsert(form)}><Save className="h-3.5 w-3.5 mr-1.5" /> Save appeal</Button>
    </div>
  );
};

// ============= Audit panel =============
const AuditPanel: React.FC<{ claimId: string }> = ({ claimId }) => {
  const { entries, loading } = useClaimAudit(claimId);
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Audit trail</h3>
      {loading ? <div className="text-xs text-muted-foreground">Loading…</div> :
        entries.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No audit entries yet</div> :
        <ul className="space-y-2">
          {entries.map(e => (
            <li key={e.id} className="text-xs border-l-2 border-border pl-3 py-1">
              <div className="font-medium">{e.action.replace(/_/g, ' ')} {e.field && <span className="text-muted-foreground">· {e.field}</span>}</div>
              <div className="text-muted-foreground">
                {new Date(e.created_at).toLocaleString('en-GB')} · {e.actor_name || 'System'}
                {e.old_value && <> · from <span className="text-foreground">{e.old_value.slice(0, 60)}</span></>}
                {e.new_value && <> → <span className="text-foreground">{e.new_value.slice(0, 60)}</span></>}
              </div>
              {e.reason && <div className="italic text-muted-foreground">Reason: {e.reason}</div>}
            </li>
          ))}
        </ul>
      }
    </div>
  );
};

// ============= Dialogs =============
const PriorityDialog: React.FC<{ claim: Claim; open: boolean; onClose: () => void; onSaved: () => void }> = ({ claim, open, onClose, onSaved }) => {
  const [priority, setPriority] = useState(claim.rawPriority || claim.priority);
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const handle = async () => {
    try {
      await updateClaimField(claim.id, 'priority', priority, claim.rawPriority || claim.priority, reason || undefined);
      toast({ title: 'Priority updated' });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change priority</DialogTitle>
          <DialogDescription>Priority is reversible and separate from status.</DialogDescription>
        </DialogHeader>
        <Fld label="Priority">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </Fld>
        <Fld label="Reason (optional)"><Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></Fld>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handle}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LogCallDialog: React.FC<{ claimId: string; open: boolean; onClose: () => void }> = ({ claimId, open, onClose }) => {
  const [called_party, setParty] = useState('customer');
  const [direction, setDirection] = useState('outbound');
  const [outcome, setOutcome] = useState('');
  const [summary, setSummary] = useState('');
  const [follow_up_required, setFollowUp] = useState(false);
  const [follow_up_date, setFollowDate] = useState('');
  const { add } = useClaimCallLogs(claimId);
  const { toast } = useToast();
  const handle = async () => {
    await add({ called_party, direction, outcome, summary, follow_up_required, follow_up_date: follow_up_date || null });
    toast({ title: 'Call logged' });
    onClose();
    setOutcome(''); setSummary(''); setFollowDate(''); setFollowUp(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log call</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Called">
            <Select value={called_party} onValueChange={setParty}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="garage">Garage</SelectItem><SelectItem value="insurer">Insurer</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
          </Fld>
          <Fld label="Direction">
            <Select value={direction} onValueChange={setDirection}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="inbound">Inbound</SelectItem></SelectContent></Select>
          </Fld>
        </div>
        <Fld label="Outcome">
          <Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spoke">Spoke</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="no_answer">No answer</SelectItem>
              <SelectItem value="left_message">Left message</SelectItem>
              <SelectItem value="callback_requested">Callback requested</SelectItem>
            </SelectContent></Select>
        </Fld>
        <Fld label="Summary"><Textarea rows={4} value={summary} onChange={e => setSummary(e.target.value)} /></Fld>
        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={follow_up_required} onChange={e => setFollowUp(e.target.checked)} id="fu" />
          <label htmlFor="fu">Follow-up required</label>
          {follow_up_required && <Input type="date" className="w-40" value={follow_up_date} onChange={e => setFollowDate(e.target.value)} />}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handle}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UploadDocumentDialog: React.FC<{ claimId: string; open: boolean; onClose: () => void }> = ({ claimId, open, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const { add } = useClaimDocuments(claimId);
  const { toast } = useToast();

  const handle = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const path = `claim-${claimId}/${Date.now()}-${file.name}`;
      // Try existing claim-attachments bucket, then fall back to customer-documents
      let bucket = 'claim-attachments';
      let up = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (up.error) {
        bucket = 'customer-documents';
        up = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      }
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      await add({
        file_url: pub.publicUrl, file_name: file.name, file_size: file.size, file_type: file.type,
        label: label || null, visibility, notes: notes || null,
      });
      toast({ title: 'Document uploaded' });
      onClose(); setFile(null); setLabel(''); setNotes('');
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
        <Fld label="File"><Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></Fld>
        <Fld label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Inspection report, Invoice, Photo evidence" /></Fld>
        <Fld label="Visibility">
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal only</SelectItem>
              <SelectItem value="customer_visible">Customer-visible</SelectItem>
            </SelectContent>
          </Select>
        </Fld>
        <Fld label="Notes"><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Fld>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handle} disabled={!file || busy}>Upload</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MileageEditDialog: React.FC<{ claim: Claim; open: boolean; onClose: () => void; onSaved: () => void }> = ({ claim, open, onClose, onSaved }) => {
  const [val, setVal] = useState(claim.claimMileage?.toString() || '');
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const handle = async () => {
    try {
      await updateClaimField(claim.id, 'mileage_at_claim', val ? Number(val) : null, claim.claimMileage, reason || undefined);
      toast({ title: 'Mileage updated' });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit claim mileage</DialogTitle><DialogDescription>Change is recorded in the audit trail.</DialogDescription></DialogHeader>
        <Fld label="Mileage at claim"><Input type="number" value={val} onChange={e => setVal(e.target.value)} /></Fld>
        <Fld label="Reason for change"><Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer provided odometer photo" /></Fld>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handle}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const GarageEditDialog: React.FC<{ claim: Claim; open: boolean; onClose: () => void; onSaved: () => void }> = ({ claim, open, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const { toast } = useToast();
  React.useEffect(() => {
    if (!open) return;
    supabase.from('claims_submissions').select('garage_name,garage_phone,garage_email').eq('id', claim.id).maybeSingle().then(({ data }) => {
      setName((data as any)?.garage_name || ''); setPhone((data as any)?.garage_phone || ''); setEmail((data as any)?.garage_email || '');
    });
  }, [open, claim.id]);
  const handle = async () => {
    try {
      await supabase.from('claims_submissions').update({ garage_name: name || null, garage_phone: phone || null, garage_email: email || null }).eq('id', claim.id);
      await logClaimAudit({ claim_id: claim.id, actor_name: null, action: 'garage_updated', field: 'garage', old_value: null, new_value: name });
      toast({ title: 'Garage saved' });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Garage details</DialogTitle></DialogHeader>
        <Fld label="Garage name"><Input value={name} onChange={e => setName(e.target.value)} /></Fld>
        <Fld label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} /></Fld>
        <Fld label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Fld>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handle}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
