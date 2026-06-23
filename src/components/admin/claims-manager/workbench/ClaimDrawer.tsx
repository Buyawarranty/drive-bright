import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Car,
  Shield,
  History,
  Paperclip,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Send,
  FileText,
  AlertCircle,
  MessageSquare,
  StickyNote,
  Clock,
  Wrench,
  CheckSquare,
} from 'lucide-react';
import type { Claim } from '@/types/claim';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClaimNotes, NOTE_TYPE_META, type ClaimNoteType } from '@/hooks/useClaimNotes';
import { useClaimTimeline } from '@/hooks/useClaimTimeline';
import { cn } from '@/lib/utils';
import { deriveStage, STAGE_META, STAGE_TO_DB_STATUS, type WorkflowStage, stageOrder } from './statusMap';
import { computeSla, slaToneCls } from './sla';
import { computeAlerts, alertToneCls } from './alerts';
import { deriveEvidenceStatus, type EvidenceItem } from './evidence';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  claim: Claim | null;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
}

type TabKey = 'overview' | 'eligibility' | 'documents' | 'repairer' | 'decision' | 'messages' | 'notes' | 'audit';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'eligibility', label: 'Warranty & Eligibility', icon: Shield },
  { key: 'documents', label: 'Documents', icon: Paperclip },
  { key: 'repairer', label: 'Repairer', icon: Wrench },
  { key: 'decision', label: 'Decision', icon: CheckSquare },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'notes', label: 'Internal Notes', icon: StickyNote },
  { key: 'audit', label: 'Audit Log', icon: Clock },
];

const CHECKLIST_ITEMS = [
  'Warranty active on claim date',
  'Vehicle mileage valid',
  'Waiting period passed',
  'Fault covered under policy',
  'Exclusion checked',
  'Service history checked',
  'Diagnostic evidence received',
  'Estimate reviewed',
  'Claim limit checked',
  'Authorisation amount entered',
];

const isImage = (a: { name: string; type?: string }) =>
  (a.type && a.type.startsWith('image/')) ||
  /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(a.name || '');

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const ClaimDrawer: React.FC<Props> = ({ claim, onClose, onUpdated }) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [authAmount, setAuthAmount] = useState<string>('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<'customer' | 'internal'>('customer');

  const { notes, addNote, deleteNote, saving: notesSaving } = useClaimNotes(claim?.id);

  useEffect(() => {
    setTab('overview');
    setChecklist({});
    setAuthAmount(claim?.amount ? String(claim.amount) : '');
    setMessageDraft('');
  }, [claim?.id]);

  const stage = useMemo(() => (claim ? deriveStage(claim) : null), [claim]);
  const sla = useMemo(() => (claim ? computeSla(claim) : null), [claim]);
  const alerts = useMemo(() => (claim ? computeAlerts(claim) : []), [claim]);
  const checklistComplete = CHECKLIST_ITEMS.every((i) => checklist[i]);

  if (!claim || !stage || !sla) return null;
  const meta = STAGE_META[stage];

  const persist = async (label: string, patch: Record<string, any>, successMsg: string) => {
    setBusy(label);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', claim.id);
      if (error) throw error;
      toast({ title: 'Updated', description: successMsg });
      await onUpdated?.();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update claim', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const moveToStage = (target: WorkflowStage, extra: Record<string, any> = {}) => {
    persist(`stage:${target}`, { status: STAGE_TO_DB_STATUS[target], ...extra }, `Moved to ${STAGE_META[target].adminLabel}`);
  };

  const handleApprove = () => {
    if (!checklistComplete) {
      toast({ title: 'Checklist incomplete', description: 'Complete the eligibility checklist before approving.', variant: 'destructive' });
      setTab('eligibility');
      return;
    }
    const amt = Number(authAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: 'Authorisation amount required', description: 'Enter the authorised amount before approving.', variant: 'destructive' });
      return;
    }
    persist(
      'approve',
      { status: STAGE_TO_DB_STATUS.approved_awaiting_invoice, approved_at: new Date().toISOString(), payment_amount: amt },
      'Claim approved — awaiting invoice',
    );
  };

  const handleDecline = () => {
    if (typeof window !== 'undefined' && !window.confirm('Decline this claim? This is a final decision.')) return;
    persist('decline', { status: STAGE_TO_DB_STATUS.declined }, 'Claim declined');
  };

  const handleRequestEvidence = async () => {
    if (!claim.email) {
      toast({ title: 'No customer email', description: 'No email on file for this claim.', variant: 'destructive' });
      return;
    }
    setBusy('evidence');
    try {
      await supabase.from('claims_submissions').update({ status: 'awaiting_info', updated_at: new Date().toISOString() }).eq('id', claim.id);
      await supabase.functions.invoke('send-claim-update-request', {
        body: {
          claimIds: [claim.id],
          recipientEmail: claim.email,
          message: `We need additional evidence to progress your claim for ${claim.reg}.`,
        },
      });
      toast({ title: 'Evidence requested', description: `Email sent to ${claim.email}.` });
      await onUpdated?.();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message || 'Could not send evidence request', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageDraft.trim()) return;
    if (messageVisibility === 'internal') {
      const ok = await addNote(messageDraft);
      if (ok) {
        setMessageDraft('');
        toast({ title: 'Internal note saved' });
      }
      return;
    }
    // Customer-visible message — fall back to evidence request email pipeline for now.
    if (!claim.email) {
      toast({ title: 'No customer email', variant: 'destructive' });
      return;
    }
    setBusy('msg');
    try {
      await supabase.functions.invoke('send-claim-update-request', {
        body: { claimIds: [claim.id], recipientEmail: claim.email, message: messageDraft },
      });
      toast({ title: 'Message sent to customer' });
      setMessageDraft('');
    } catch (e: any) {
      toast({ title: 'Send failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const attachments = claim.attachments ?? [];

  return (
    <aside className="w-full lg:w-[460px] xl:w-[520px] shrink-0 bg-card border border-border rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-160px)] lg:sticky lg:top-4">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
            {initials(claim.customerName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">{claim.customerName}</div>
            <div className="text-xs text-muted-foreground">
              Claim BAW-{claim.reg} · Opened {claim.date}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border', meta.cls)}>
            {meta.adminLabel}
          </span>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border', slaToneCls[sla.tone])}>
            SLA · {sla.label}
          </span>
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border capitalize',
            claim.priority === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
            claim.priority === 'high' ? 'bg-amber-100 text-amber-800 border-amber-200' :
            'bg-blue-100 text-blue-700 border-blue-200',
          )}>
            {claim.priority}
          </span>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span key={a.key} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border', alertToneCls[a.tone])}>
                <AlertCircle className="h-3 w-3" />
                {a.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border bg-card">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {tab === 'overview' && (
          <>
            <Section title="Customer">
              <Row icon={Mail}><a href={`mailto:${claim.email}`} className="text-blue-600 hover:underline break-all">{claim.email || '—'}</a></Row>
              <Row icon={Phone}>{claim.phone ? <a href={`tel:${claim.phone}`} className="text-blue-600 hover:underline">{claim.phone}</a> : '—'}</Row>
            </Section>
            <Section title="Vehicle">
              <Row icon={Car}>{claim.reg}</Row>
              <Row icon={Shield}>Plan: <span className="font-semibold ml-1">{claim.tier || '—'}</span></Row>
              <Row icon={History}>Previous claims: <span className="font-semibold ml-1">{claim.previousClaims ?? 0}</span></Row>
            </Section>
            <Section title="Claim summary">
              <div className="text-foreground whitespace-pre-wrap">{claim.issue}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Estimate: <span className="font-mono font-semibold text-foreground">£{claim.amount.toLocaleString()}</span>
                {' · '}Evidence: <span className="font-semibold text-foreground">{claim.evidence}</span>
                {' · '}Days open: <span className="font-semibold text-foreground">{claim.ageInDays}</span>
              </div>
            </Section>
          </>
        )}

        {tab === 'eligibility' && (
          <>
            <Section title="Warranty facts">
              <Row label="Plan tier">{claim.tier || '—'}</Row>
              <Row label="Days on risk">{claim.daysOnRisk ?? '—'}</Row>
              <Row label="Mileage at purchase">{claim.purchaseMileage?.toLocaleString() ?? '—'}</Row>
              <Row label="Mileage at claim">{claim.claimMileage?.toLocaleString() ?? '—'}</Row>
            </Section>
            <Section title="Eligibility checklist">
              <ul className="space-y-1.5">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item}>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!checklist[item]}
                        onChange={(e) => setChecklist((p) => ({ ...p, [item]: e.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-muted-foreground">
                {checklistComplete ? '✓ Checklist complete — ready to decide.' : `${CHECKLIST_ITEMS.filter((i) => checklist[i]).length} / ${CHECKLIST_ITEMS.length} complete`}
              </div>
            </Section>
          </>
        )}

        {tab === 'documents' && (
          <>
            <DocumentGroup title="Customer uploads" items={attachments} />
            <DocumentGroup title="Garage uploads" items={[]} />
            <DocumentGroup title="Admin documents" items={[]} />
            <DocumentGroup title="Invoices" items={[]} />
            <Section title="Request documents">
              <div className="flex flex-wrap gap-1.5">
                {['Diagnosis report', 'Repair estimate', 'Service history', 'Invoice', 'Clearer photo'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={handleRequestEvidence}
                    disabled={busy === 'evidence'}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card hover:bg-muted text-xs"
                  >
                    Request: {label}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'repairer' && (
          <Section title="Repairer / Garage">
            <div className="text-xs text-muted-foreground">
              No repairer details captured for this claim. (Coming soon — capture garage contact, estimate, and invoice here.)
            </div>
          </Section>
        )}

        {tab === 'decision' && (
          <>
            <Section title="Authorisation">
              <label className="block text-xs text-muted-foreground mb-1">Authorisation amount (£)</label>
              <input
                type="number"
                value={authAmount}
                onChange={(e) => setAuthAmount(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-border bg-card text-sm"
                placeholder="0.00"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                Checklist: {checklistComplete ? <span className="text-emerald-600 font-semibold">Complete</span> : <button type="button" onClick={() => setTab('eligibility')} className="text-blue-600 underline">incomplete — open</button>}
              </div>
            </Section>
            <Section title="Move to stage">
              <div className="flex flex-wrap gap-1.5">
                {stageOrder.filter((s) => s !== 'declined' && s !== 'closed').map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => moveToStage(s)}
                    disabled={busy === `stage:${s}` || s === stage}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium',
                      s === stage ? 'bg-muted border-border text-muted-foreground cursor-default' : 'bg-card border-border hover:bg-muted text-foreground',
                    )}
                  >
                    {STAGE_META[s].adminLabel}
                    {s !== stage && <ChevronRight className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Decision">
              <div className="flex flex-wrap gap-2">
                <ActionBtn variant="success" onClick={handleApprove} loading={busy === 'approve'} icon={CheckCircle2}>
                  Approve
                </ActionBtn>
                <ActionBtn variant="danger" onClick={handleDecline} loading={busy === 'decline'} icon={XCircle}>
                  Decline
                </ActionBtn>
                <ActionBtn variant="default" onClick={handleRequestEvidence} loading={busy === 'evidence'} icon={Mail}>
                  Request Evidence
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => persist('escalate', { priority: 'critical' }, 'Escalated to critical')} icon={AlertCircle}>
                  Escalate
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => persist('mark-overdue', { status: 'overdue' }, 'Claim marked as overdue')} loading={busy === 'mark-overdue'} icon={Clock}>
                  Mark Overdue
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => moveToStage('closed')} icon={X}>
                  Close Claim
                </ActionBtn>
              </div>
            </Section>
          </>
        )}

        {tab === 'messages' && (
          <>
            <Section title="New message">
              <div className="flex items-center gap-2 mb-2">
                <label className="inline-flex items-center gap-1 text-xs">
                  <input type="radio" checked={messageVisibility === 'customer'} onChange={() => setMessageVisibility('customer')} />
                  <span className="text-blue-700 font-semibold">Customer-visible</span>
                </label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input type="radio" checked={messageVisibility === 'internal'} onChange={() => setMessageVisibility('internal')} />
                  <span className="text-amber-700 font-semibold">Internal note</span>
                </label>
              </div>
              <textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-sm"
                placeholder={messageVisibility === 'customer' ? 'Message to customer…' : 'Internal note (not visible to customer)…'}
              />
              <div className="mt-2 flex justify-end">
                <ActionBtn
                  variant="primary"
                  onClick={handleSendMessage}
                  loading={busy === 'msg' || notesSaving}
                  icon={Send}
                >
                  {messageVisibility === 'customer' ? 'Send to customer' : 'Save internal note'}
                </ActionBtn>
              </div>
            </Section>
            <Section title="Internal notes thread">
              {notes.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No notes yet.</div>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-amber-900">{n.created_by_name || 'Staff'}</span>
                        <button onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-red-600">Delete</button>
                      </div>
                      <div className="whitespace-pre-wrap text-foreground/90">{n.note}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        {tab === 'notes' && (
          <Section title="Internal notes">
            {notes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No notes yet. Add one from the Messages tab.</div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-amber-900">{n.created_by_name || 'Staff'}</span>
                      <button onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-red-600">Delete</button>
                    </div>
                    <div className="whitespace-pre-wrap text-foreground/90">{n.note}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === 'audit' && (
          <Section title="Audit log">
            <div className="text-xs text-muted-foreground">
              Status transitions, assignments and system events will appear here. (Wiring up to <code>warranty_audit_log</code> in a follow-up.)
            </div>
          </Section>
        )}
      </div>
    </aside>
  );
};

// ---------- helpers ----------

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Row: React.FC<{ icon?: React.ComponentType<any>; label?: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2 text-sm">
    {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
    {label && <span className="text-muted-foreground shrink-0">{label}:</span>}
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const DocumentGroup: React.FC<{ title: string; items: { url: string; name: string; size?: number; type?: string }[] }> = ({ title, items }) => (
  <Section title={`${title} (${items.length})`}>
    {items.length === 0 ? (
      <div className="text-xs text-muted-foreground italic">No documents.</div>
    ) : (
      <ul className="space-y-1.5">
        {items.map((a, i) => (
          <li key={i} className="flex items-center gap-2 p-1.5 rounded border border-border bg-muted/20">
            {isImage(a) ? (
              <img src={a.url} alt={a.name} className="h-8 w-8 rounded border border-border object-cover" loading="lazy" />
            ) : (
              <div className="h-8 w-8 rounded border border-border bg-card flex items-center justify-center">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs font-medium text-blue-600 hover:underline truncate">
              {a.name}
            </a>
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="h-6 w-6 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted">
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    )}
  </Section>
);

const ActionBtn: React.FC<{
  variant: 'default' | 'primary' | 'success' | 'danger';
  onClick: () => void;
  loading?: boolean;
  icon?: React.ComponentType<any>;
  children: React.ReactNode;
}> = ({ variant, onClick, loading, icon: Icon, children }) => {
  const cls = {
    default: 'bg-card text-foreground border-border hover:bg-muted',
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    success: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold transition-colors disabled:opacity-50', cls)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
};
