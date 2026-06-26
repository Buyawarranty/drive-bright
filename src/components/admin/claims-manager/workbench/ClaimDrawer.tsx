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
  Upload,
  Flag,
  Edit3,
  Gavel,
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
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  claim: Claim | null;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
  /** Render in full-page mode (used by /admin/claims/:id). */
  fullPage?: boolean;
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

export const ClaimDrawer: React.FC<Props> = ({ claim, onClose, onUpdated, fullPage = false }) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [authAmount, setAuthAmount] = useState<string>('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<'customer' | 'internal'>('customer');
  const [noteType, setNoteType] = useState<ClaimNoteType>('general');
  const [editingMileage, setEditingMileage] = useState(false);
  const [mileageDraft, setMileageDraft] = useState<string>('');
  const [customEvidenceMsg, setCustomEvidenceMsg] = useState('');
  const [adminUploads, setAdminUploads] = useState<{ url: string; name: string; size?: number; type?: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingClaimStatusChange | null>(null);

  const { notes, addNote, deleteNote, saving: notesSaving } = useClaimNotes(claim?.id);
  const { events: timelineEvents, loading: timelineLoading } = useClaimTimeline(claim?.id);

  useEffect(() => {
    setTab('overview');
    setChecklist({});
    setAuthAmount(claim?.amount ? String(claim.amount) : '');
    setMessageDraft('');
    setNoteType('general');
    setEditingMileage(false);
    setMileageDraft(claim?.claimMileage ? String(claim.claimMileage) : '');
    setCustomEvidenceMsg('');
    setAdminUploads([]);
  }, [claim?.id]);

  const stage = useMemo(() => (claim ? deriveStage(claim) : null), [claim]);
  const sla = useMemo(() => (claim ? computeSla(claim) : null), [claim]);
  const alerts = useMemo(() => (claim ? computeAlerts(claim) : []), [claim]);
  const checklistComplete = CHECKLIST_ITEMS.every((i) => checklist[i]);

  if (!claim || !stage || !sla) return null;
  const meta = STAGE_META[stage];

  // Apply the DB patch without any email prompt — used internally by `persist`
  // after the review-before-send dialog confirms a status change, and directly
  // for changes that don't carry a customer-facing status update.
  const applyPatch = async (label: string, patch: Record<string, any>, successMsg: string) => {
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

  // Public entry point. Any status change routes through the email review dialog;
  // pure metadata patches apply immediately.
  const persist = async (label: string, patch: Record<string, any>, successMsg: string) => {
    const newStatus = typeof patch.status === 'string' ? patch.status : null;
    if (newStatus && newStatus !== (claim as any).rawStatus) {
      setPendingStatusChange({
        claimId: claim.id,
        status: newStatus,
        label: successMsg,
        onSent: () => applyPatch(label, patch, successMsg),
      });
      return;
    }
    await applyPatch(label, patch, successMsg);
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
    setPendingStatusChange({
      claimId: claim.id,
      status: 'awaiting_info',
      label: 'Evidence requested',
      bodyOverride: `Thank you for submitting your claim. To continue reviewing it, we need some further information from you.\n\nWe need additional evidence to progress your claim for ${claim.reg}.\n\nPlease do not authorise, start, or pay for any repair work until your claim has been reviewed and approved by our claims team. Repairs carried out without prior written authorisation may not be covered.`,
      onSent: () => applyPatch('evidence', { status: 'awaiting_info' }, 'Evidence requested'),
    });
  };

  const handleRequestEvidenceItem = async (item: EvidenceItem) => {
    if (!claim.email) {
      toast({ title: 'No customer email', description: 'No email on file for this claim.', variant: 'destructive' });
      return;
    }
    setPendingStatusChange({
      claimId: claim.id,
      status: 'awaiting_info',
      label: `${item.label} requested`,
      bodyOverride: `Thank you for submitting your claim. To continue reviewing it, we need some further information from you.\n\n${item.requestMessage(claim)}\n\nPlease do not authorise, start, or pay for any repair work until your claim has been reviewed and approved by our claims team. Repairs carried out without prior written authorisation may not be covered.`,
      onSent: () => applyPatch(`evidence:${item.key}`, { status: 'awaiting_info' }, `${item.label} requested`),
    });
  };

  const handleSaveMileage = async () => {
    const m = Number(mileageDraft);
    if (!Number.isFinite(m) || m < 0) {
      toast({ title: 'Invalid mileage', variant: 'destructive' });
      return;
    }
    await persist('mileage', { mileage_at_claim: m }, 'Claim mileage updated');
    setEditingMileage(false);
  };

  const handleSendCustomEvidence = async () => {
    if (!customEvidenceMsg.trim()) {
      toast({ title: 'Message required', variant: 'destructive' });
      return;
    }
    if (!claim.email) {
      toast({ title: 'No customer email', variant: 'destructive' });
      return;
    }
    setPendingStatusChange({
      claimId: claim.id,
      status: 'awaiting_info',
      label: 'Custom evidence request',
      bodyOverride: customEvidenceMsg,
      onSent: async () => {
        await applyPatch('custom-evidence', { status: 'awaiting_info' }, 'Custom request sent');
        setCustomEvidenceMsg('');
      },
    });
  };

  const handleAdminUpload = async (file: File) => {
    setBusy('upload');
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `admin/${claim.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('claim-updates').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('claim-updates').getPublicUrl(path);
      const newItem = { url: publicUrl, name: file.name, size: file.size, type: file.type };
      setAdminUploads((prev) => [...prev, newItem]);
      toast({ title: 'Uploaded', description: file.name });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleSetPriority = (next: Claim['priority']) => {
    persist(`prio:${next}`, { priority: next }, `Priority set to ${next}`);
  };

  const handleAppeal = () => {
    persist('appeal', { status: 'appealed' }, 'Marked as appealed');
  };



  const handleSendMessage = async () => {
    if (!messageDraft.trim()) return;
    if (messageVisibility === 'internal') {
      const ok = await addNote(messageDraft, noteType);
      if (ok) {
        setMessageDraft('');
        toast({ title: 'Internal note saved' });
      }
      return;
    }
    // Customer-visible message — route through the editable review-before-send dialog.
    if (!claim.email) {
      toast({ title: 'No customer email', variant: 'destructive' });
      return;
    }
    setPendingStatusChange({
      claimId: claim.id,
      status: (claim as any).rawStatus || 'in_progress',
      label: 'Send message to customer',
      subjectOverride: 'Update on your warranty claim',
      bodyOverride: messageDraft,
      onSent: async () => {
        await addNote(`[Customer email] ${messageDraft}`, noteType);
        setMessageDraft('');
      },
    });
  };

  const attachments = claim.attachments ?? [];

  return (
    <aside
      className={cn(
        'bg-card border border-border rounded-lg overflow-hidden flex flex-col',
        fullPage
          ? 'w-full'
          : 'w-full lg:w-[460px] xl:w-[520px] shrink-0 max-h-[calc(100vh-160px)] lg:sticky lg:top-4',
      )}
    >
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
          {!fullPage && (
            <a
              href={`/admin/claims/${claim.id}`}
              target="_blank"
              rel="noreferrer"
              title="Open full page"
              className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={fullPage ? 'Back to claims' : 'Close drawer'}
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
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">Mileage at claim:</span>
                {editingMileage ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      value={mileageDraft}
                      onChange={(e) => setMileageDraft(e.target.value)}
                      className="flex-1 h-7 px-2 rounded border border-border bg-card text-xs"
                      placeholder="e.g. 75000"
                    />
                    <button onClick={handleSaveMileage} disabled={busy === 'mileage'} className="px-2 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold disabled:opacity-50">
                      {busy === 'mileage' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                    </button>
                    <button onClick={() => { setEditingMileage(false); setMileageDraft(claim.claimMileage ? String(claim.claimMileage) : ''); }} className="px-2 py-1 rounded border border-border text-[11px]">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-semibold">{claim.claimMileage?.toLocaleString() ?? '—'}</span>
                    <button onClick={() => setEditingMileage(true)} className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                  </div>
                )}
              </div>
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
            <Section title="Evidence checklist">
              <ul className="space-y-1.5">
                {deriveEvidenceStatus(claim).map(({ item, received, matches }) => (
                  <li
                    key={item.key}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border p-2',
                      received ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/40',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {received ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
                        {item.label}
                      </div>
                      <div className={cn('text-[11px]', received ? 'text-emerald-700' : 'text-amber-700')}>
                        {received ? `${matches.length} file${matches.length === 1 ? '' : 's'} received` : 'Not received yet'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRequestEvidenceItem(item)}
                      disabled={busy === `evidence:${item.key}`}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card hover:bg-muted text-[11px] font-medium"
                    >
                      {busy === `evidence:${item.key}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      Request
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Custom evidence request">
              <textarea
                value={customEvidenceMsg}
                onChange={(e) => setCustomEvidenceMsg(e.target.value)}
                rows={3}
                placeholder={`Write a custom message to the customer (e.g. "Please send a photo of the gearbox dipstick reading for ${claim.reg}").`}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-sm"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSendCustomEvidence}
                  disabled={busy === 'custom-evidence' || !customEvidenceMsg.trim()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-blue-600 bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy === 'custom-evidence' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send custom request
                </button>
              </div>
            </Section>
            <DocumentGroup title="Customer uploads" items={attachments} />
            <Section title={`Admin documents (${adminUploads.length})`}>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAdminUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy === 'upload'}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card hover:bg-muted text-xs font-semibold disabled:opacity-50"
              >
                {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload document
              </button>
              {adminUploads.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {adminUploads.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 p-1.5 rounded border border-border bg-muted/20 text-xs">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-blue-600 hover:underline truncate">{a.name}</a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <DocumentGroup title="Invoices" items={[]} />
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
                {stageOrder.filter((s) => s !== 'declined' && s !== 'closed' && s !== 'cancelled').map((s) => (
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
            <Section title="Priority">
              <div className="flex flex-wrap gap-1.5">
                {(['critical', 'high', 'normal', 'low'] as const).map((p) => {
                  const active = claim.priority === p;
                  const tone =
                    p === 'critical' ? 'bg-red-600 text-white border-red-600' :
                    p === 'high' ? 'bg-amber-500 text-white border-amber-500' :
                    p === 'normal' ? 'bg-blue-600 text-white border-blue-600' :
                    'bg-slate-500 text-white border-slate-500';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSetPriority(p)}
                      disabled={busy === `prio:${p}` || active}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-semibold capitalize transition-colors',
                        active ? tone : 'bg-card border-border text-foreground hover:bg-muted',
                      )}
                    >
                      <Flag className="h-3 w-3" /> {p}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Click any level to change — including back down from critical.</div>
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
                <ActionBtn variant="default" onClick={handleAppeal} loading={busy === 'appeal'} icon={Gavel}>
                  Mark as Appealed
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => persist('mark-overdue', { status: 'overdue' }, 'Claim marked as overdue')} loading={busy === 'mark-overdue'} icon={Clock}>
                  Mark Overdue
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => moveToStage('cancelled')} loading={busy === 'stage:cancelled'} icon={X}>
                  Cancel Claim
                </ActionBtn>
                <ActionBtn variant="default" onClick={() => moveToStage('closed')} loading={busy === 'stage:closed'} icon={X}>
                  Close Claim
                </ActionBtn>
              </div>
            </Section>
          </>
        )}

        {tab === 'messages' && (
          <>
            <Section title="New message">
              <div className="flex items-center gap-3 mb-2">
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                  <input type="radio" checked={messageVisibility === 'customer'} onChange={() => setMessageVisibility('customer')} />
                  <span className="text-blue-700 font-semibold">Customer-visible</span>
                </label>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                  <input type="radio" checked={messageVisibility === 'internal'} onChange={() => setMessageVisibility('internal')} />
                  <span className="text-amber-700 font-semibold">Internal note</span>
                </label>
              </div>
              {messageVisibility === 'internal' && (
                <div className="mb-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Note type</label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as ClaimNoteType)}
                    className="w-full h-8 px-2 rounded-md border border-border bg-card text-xs"
                  >
                    {(Object.keys(NOTE_TYPE_META) as ClaimNoteType[]).map((k) => (
                      <option key={k} value={k}>{NOTE_TYPE_META[k].label}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <NotesList notes={notes} onDelete={deleteNote} />
            </Section>
          </>
        )}

        {tab === 'notes' && (
          <Section title="Internal notes">
            <NotesList notes={notes} onDelete={deleteNote} emptyHint="No notes yet. Add one from the Messages tab." />
          </Section>
        )}

        {tab === 'audit' && (
          <Section title="Timeline">
            {timelineLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading timeline…
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No activity recorded yet.</div>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-3 pl-4">
                {timelineEvents.map((e) => (
                  <li key={e.id} className="relative">
                    <span className={cn(
                      'absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                      e.tone === 'good' ? 'bg-emerald-500' :
                      e.tone === 'warn' ? 'bg-amber-500' :
                      e.tone === 'bad' ? 'bg-rose-500' :
                      e.tone === 'info' ? 'bg-blue-500' :
                      'bg-slate-400',
                    )} />
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {e.title}
                      {e.noteType && (
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', NOTE_TYPE_META[e.noteType].cls)}>
                          {NOTE_TYPE_META[e.noteType].label}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground" title={new Date(e.at).toLocaleString()}>
                      {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                      {e.actor && <> · {e.actor}</>}
                    </div>
                    {e.detail && (
                      <div className="mt-1 text-xs text-foreground/80 whitespace-pre-wrap line-clamp-4">{e.detail}</div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        )}
      </div>

      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be emailed to the customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Recipient</div>
              <div className="text-sm font-medium">{claim.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Message</div>
              <div className="text-sm whitespace-pre-wrap border border-border rounded-md bg-muted/30 p-3">{messageDraft}</div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmSendOpen(false)}>Edit</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSendMessage}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ClaimStatusEmailPreviewDialog
        pending={pendingStatusChange}
        onClose={() => setPendingStatusChange(null)}
      />
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

const NotesList: React.FC<{
  notes: { id: string; note: string; note_type: ClaimNoteType; created_at: string; created_by_name: string | null }[];
  onDelete: (id: string) => void;
  emptyHint?: string;
}> = ({ notes, onDelete, emptyHint = 'No notes yet.' }) => {
  if (notes.length === 0) {
    return <div className="text-xs text-muted-foreground italic">{emptyHint}</div>;
  }
  return (
    <ul className="space-y-2">
      {notes.map((n) => {
        const meta = NOTE_TYPE_META[n.note_type] || NOTE_TYPE_META.general;
        return (
          <li key={n.id} className="rounded border border-border bg-card p-2 text-xs">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', meta.cls)}>
                  {meta.label}
                </span>
                <span className="font-semibold text-foreground truncate">{n.created_by_name || 'Staff'}</span>
                <span className="text-[10px] text-muted-foreground shrink-0" title={new Date(n.created_at).toLocaleString()}>
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </div>
              <button onClick={() => onDelete(n.id)} className="text-muted-foreground hover:text-red-600 shrink-0">Delete</button>
            </div>
            <div className="whitespace-pre-wrap text-foreground/90">{n.note}</div>
          </li>
        );
      })}
    </ul>
  );
};



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
