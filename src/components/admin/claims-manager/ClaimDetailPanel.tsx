import React, { useEffect, useState } from 'react';
import { X, Phone, Mail, Car, Shield, History, Trash2, Loader2, Paperclip, Download, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Claim } from '@/types/claim';
import { useClaimNotes } from '@/hooks/useClaimNotes';
import { RemindMePopover } from '@/components/admin/leads/RemindMePopover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClaimDetailPanelProps {
  claim: Claim | null;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const statusBadgeMap: Record<Claim['status'], { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200' },
  evidence: { label: 'Evidence Needed', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  review: { label: 'In Review', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  open: { label: 'Open', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityCls: Record<Claim['priority'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const evidenceCls: Record<Claim['evidence'], string> = {
  Missing: 'text-red-600',
  Partial: 'text-amber-600',
  Received: 'text-green-600',
};

// Map our simplified UI status -> raw DB status
const UI_TO_DB_STATUS: Record<Claim['status'], string> = {
  open: 'new',
  evidence: 'awaiting_info',
  review: 'in_review',
  approved: 'approved',
  overdue: 'overdue',
  closed: 'closed',
};

const FooterBtn: React.FC<{
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, onClick, variant = 'default', disabled, loading }) => {
  const cls =
    variant === 'primary'
      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
      : variant === 'danger'
      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
      : 'bg-card text-foreground border-border hover:bg-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
};

const isImage = (a: { name: string; type?: string }) =>
  (a.type && a.type.startsWith('image/')) ||
  /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(a.name || '');

export const ClaimDetailPanel: React.FC<ClaimDetailPanelProps> = ({ claim, onClose, onUpdated }) => {
  const { toast } = useToast();
  const [statusDraft, setStatusDraft] = useState<Claim['status'] | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { notes, loading: notesLoading, saving: notesSaving, addNote, deleteNote } =
    useClaimNotes(claim?.id);

  useEffect(() => {
    setStatusDraft(claim?.status || '');
  }, [claim?.id, claim?.status]);

  if (!claim) return null;

  const status = statusBadgeMap[claim.status];
  const attachments = claim.attachments ?? [];

  const handleSaveNote = async () => {
    const ok = await addNote(note);
    if (ok) setNote('');
  };

  const updateClaim = async (
    actionLabel: string,
    patch: Record<string, any>,
    successMsg: string,
  ) => {
    if (!claim) return;
    setBusy(actionLabel);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', claim.id);
      if (error) throw error;
      toast({ title: 'Updated', description: successMsg });
      await onUpdated?.();
    } catch (e: any) {
      console.error(`Claim ${actionLabel} failed`, e);
      toast({
        title: 'Update failed',
        description: e?.message || 'Could not update claim',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveStatus = () => {
    if (!statusDraft) {
      toast({ title: 'Pick a status', description: 'Select a status before saving.', variant: 'destructive' });
      return;
    }
    if (statusDraft === claim.status) {
      toast({ title: 'No change', description: 'This claim is already set to that status.' });
      return;
    }
    const dbStatus = UI_TO_DB_STATUS[statusDraft];
    const patch: Record<string, any> = { status: dbStatus };
    if (statusDraft === 'approved') patch.approved_at = new Date().toISOString();
    if (statusDraft === 'closed') patch.paid_at = patch.paid_at || null;
    updateClaim('save-status', patch, `Status set to ${statusDraft}`);
  };

  const confirmAction = (message: string) =>
    typeof window === 'undefined' ? true : window.confirm(message);

  const handleApprove = () => {
    if (!confirmAction(`Approve this claim for ${claim.customerName} (${claim.reg})?\n\nThis will mark the claim as approved.`)) return;
    updateClaim(
      'approve',
      { status: 'approved', approved_at: new Date().toISOString() },
      'Claim approved',
    );
  };

  const handleClose = () => {
    if (!confirmAction(`Close this claim for ${claim.customerName} (${claim.reg})?\n\nClosed claims are removed from the active queue.`)) return;
    updateClaim('close', { status: 'closed' }, 'Claim closed');
  };

  const handleEscalate = () => {
    if (!confirmAction(`Escalate this claim to CRITICAL priority?\n\n${claim.customerName} (${claim.reg}) will be flagged as high risk.`)) return;
    updateClaim('escalate', { priority: 'critical' }, 'Claim escalated to critical');
  };

  const handleRequestEvidence = async () => {
    if (!claim.email) {
      toast({
        title: 'No customer email',
        description: `No email on file for ${claim.customerName} (${claim.reg}). Cannot send evidence request.`,
        variant: 'destructive',
      });
      return;
    }
    if (
      !confirmAction(
        `Send an evidence request email to ${claim.email}?\n\nThis will email the customer a secure link to upload additional information for ${claim.reg}, and mark the claim as awaiting evidence.`,
      )
    )
      return;

    setBusy('evidence');
    try {
      // 1) Update claim status
      const { error: updateError } = await supabase
        .from('claims_submissions')
        .update({ status: 'awaiting_info', updated_at: new Date().toISOString() })
        .eq('id', claim.id);
      if (updateError) throw updateError;

      // 2) Send the evidence request email to the customer
      const { error: emailError } = await supabase.functions.invoke('send-claim-update-request', {
        body: {
          claimIds: [claim.id],
          recipientEmail: claim.email,
          message: `We need additional evidence to progress your claim for ${claim.reg}. Please use the link below to upload any supporting documents, invoices or photos.`,
        },
      });
      if (emailError) throw emailError;

      toast({
        title: 'Evidence request sent',
        description: `Email sent to ${claim.email}. Claim marked as awaiting evidence.`,
      });
      await onUpdated?.();
    } catch (e: any) {
      console.error('Request evidence failed', e);
      toast({
        title: 'Could not send evidence request',
        description: e?.message || 'Email failed to send. The status was not changed.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleLogCall = () => {
    if (!confirmAction(`Log a call for ${claim.customerName} (${claim.reg})?\n\nThis will update the last contacted timestamp to now.`)) return;
    updateClaim(
      'log-call',
      { last_contacted_at: new Date().toISOString() },
      'Call logged',
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 p-4 border-b border-border bg-muted/30">
        <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {initials(claim.customerName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground truncate">{claim.customerName}</div>
          <div className="text-xs text-muted-foreground">
            Claim #BAW-{claim.reg} · Opened {claim.date}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${status.cls}`}>
            {status.label}
          </span>
          {claim.priority === 'critical' && (
            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityCls.critical}`}>
              Critical
            </span>
          )}
          <RemindMePopover leadId={`claim_${claim.id}`} compact />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="ml-1 inline-flex items-center justify-center h-8 w-8 rounded border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Column 1: Customer */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>
          <div className="space-y-2 text-sm break-words">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <a href={`mailto:${claim.email}`} className="break-all text-blue-600 hover:underline">{claim.email}</a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              {claim.phone ? (
                <a href={`tel:${claim.phone}`} className="text-blue-600 hover:underline">{claim.phone}</a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground shrink-0" /> {claim.reg}</div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground shrink-0" /> Plan tier: <span className="font-semibold">{claim.tier || '—'}</span></div>
            <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground shrink-0" /> Previous claims: <span className="font-semibold">{claim.previousClaims ?? 0}</span></div>
          </div>

          {/* Customer-uploaded attachments */}
          <div className="pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Customer uploads
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-muted text-[10px] font-bold text-foreground">
                {attachments.length}
              </span>
            </h3>
            {attachments.length === 0 ? (
              <div className="mt-2 text-xs text-muted-foreground italic">
                No files were uploaded with this claim.
              </div>
            ) : (
              <ul className="mt-2 space-y-2">
                {attachments.map((a, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20">
                    {isImage(a) ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={a.url} alt={a.name} className="h-10 w-10 object-cover rounded border border-border" loading="lazy" />
                      </a>
                    ) : (
                      <div className="h-10 w-10 flex items-center justify-center bg-card border border-border rounded shrink-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs font-medium text-blue-600 hover:underline"
                        title={a.name}
                      >
                        {a.name}
                      </a>
                      {a.size ? (
                        <span className="text-[10px] text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</span>
                      ) : null}
                    </div>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View"
                      className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={a.url}
                      download={a.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download"
                      className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Column 2: Claim details */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claim details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Issue:</span> <div className="mt-0.5 whitespace-pre-wrap">{claim.issue}</div></div>
            <div>
              <span className="text-muted-foreground">Cost estimate:</span>{' '}
              <span className="font-mono font-semibold">£{claim.amount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Evidence:</span>{' '}
              <span className={`font-semibold ${evidenceCls[claim.evidence]}`}>{claim.evidence}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Days open:</span>{' '}
              <span className={`font-semibold ${claim.ageInDays >= 10 ? 'text-red-600' : 'text-foreground'}`}>
                {claim.ageInDays}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Assignee:</span>{' '}
              <span className="font-semibold">{claim.assignee === 'unassigned' ? 'Unassigned' : claim.assignee}</span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Change status to
            </label>
            <div className="flex gap-2">
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as Claim['status'])}
                className="flex-1 h-9 px-2 rounded-md border border-border bg-card text-sm"
              >
                <option value="">Select…</option>
                <option value="open">Open</option>
                <option value="evidence">Evidence Needed</option>
                <option value="review">In Review</option>
                <option value="approved">Approved</option>
                <option value="closed">Closed</option>
              </select>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={busy === 'save-status' || !statusDraft}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-blue-600 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'save-status' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Status
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              "Overdue" is set automatically when a claim has been open 7+ days without action — it isn't a manual status.
            </p>
          </div>
        </div>

        {/* Column 3: Notes thread */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Internal notes
            </h3>
            <span className="text-[11px] text-muted-foreground">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
          </div>

          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note for the team…"
              className="w-full p-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!note.trim() || notesSaving}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-blue-600 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {notesSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Note
              </button>
            </div>
          </div>

          <div className="pt-1 space-y-2 max-h-72 overflow-y-auto">
            {notesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes…
              </div>
            ) : notes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2">
                No notes yet. Add the first one above.
              </div>
            ) : (
              notes.map((n) => {
                const when = new Date(n.created_at);
                const author = n.created_by_name || 'Staff';
                return (
                  <div key={n.id} className="group rounded-md border border-border bg-muted/30 p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-foreground truncate">{author}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground" title={when.toLocaleString()}>
                          {formatDistanceToNow(when, { addSuffix: true })}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteNote(n.id)}
                          aria-label="Delete note"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-foreground">{n.note}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
        <FooterBtn
          label="Escalate"
          onClick={handleEscalate}
          variant="danger"
          loading={busy === 'escalate'}
          disabled={claim.priority === 'critical'}
        />
        <FooterBtn
          label="Request Evidence"
          onClick={handleRequestEvidence}
          loading={busy === 'evidence'}
        />
        <FooterBtn
          label="Log Call"
          onClick={handleLogCall}
          loading={busy === 'log-call'}
          disabled={!claim.phone}
        />
        <FooterBtn
          label="Approve Claim"
          onClick={handleApprove}
          variant="primary"
          loading={busy === 'approve'}
          disabled={claim.status === 'approved' || claim.status === 'closed'}
        />
        <FooterBtn
          label="Close Claim"
          onClick={handleClose}
          loading={busy === 'close'}
          disabled={claim.status === 'closed'}
        />
      </div>
    </div>
  );
};
