import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, CheckCircle2, AlertCircle, Inbox, Archive } from 'lucide-react';
import { AssignMenu } from './AssignMenu';
import { STAGE_TO_DB_STATUS, type WorkflowStage } from './statusMap';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';
import { cn } from '@/lib/utils';

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
  onDone: () => void | Promise<void>;
}

interface QuickStage {
  stage: WorkflowStage;
  label: string;
  icon: React.ComponentType<any>;
  tone: string;
}

const QUICK_STAGES: QuickStage[] = [
  { stage: 'in_review', label: 'In review', icon: Inbox, tone: 'text-blue-700 hover:bg-blue-50' },
  { stage: 'evidence_needed', label: 'Evidence needed', icon: AlertCircle, tone: 'text-amber-700 hover:bg-amber-50' },
  { stage: 'approved_awaiting_invoice', label: 'Approve', icon: CheckCircle2, tone: 'text-emerald-700 hover:bg-emerald-50' },
  { stage: 'closed', label: 'Close', icon: Archive, tone: 'text-slate-700 hover:bg-slate-100' },
];

export const BulkActionBar: React.FC<Props> = ({ selectedIds, onClear, onDone }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingClaimStatusChange | null>(null);
  const [queue, setQueue] = useState<{ ids: string[]; status: string; label: string } | null>(null);

  const count = selectedIds.size;
  if (count === 0 && !pendingChange) return null;

  const ids = Array.from(selectedIds);

  const runAssign = async (uid: string | null) => {
    setBusy('assign');
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ assigned_to: uid, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      toast({ title: 'Updated', description: `${uid ? 'Reassigned' : 'Unassigned'} (${count})` });
      await onDone();
      onClear();
    } catch (e: any) {
      toast({ title: 'Bulk update failed', description: e?.message || 'Could not apply changes', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  // Bulk status change: preview the email on the FIRST selected claim, then on send
  // apply the same status (and matching edited email) to every selected claim sequentially.
  const startStageChange = (q: QuickStage) => {
    if (ids.length === 0) return;
    const newStatus = STAGE_TO_DB_STATUS[q.stage];
    const allIds = [...ids];
    setQueue({ ids: allIds, status: newStatus, label: q.label });
    setPendingChange({
      claimId: allIds[0],
      status: newStatus,
      label: `${q.label} (${allIds.length} claim${allIds.length === 1 ? '' : 's'})`,
      onSent: async () => {
        setBusy(`stage-${q.stage}`);
        try {
          // Update DB for all selected
          const { error } = await supabase
            .from('claims_submissions')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .in('id', allIds);
          if (error) throw error;

          // Email the remaining claims (the first was already sent by the preview dialog)
          const rest = allIds.slice(1);
          for (const id of rest) {
            try {
              await supabase.functions.invoke('send-claim-status-email', {
                body: { claimId: id, status: newStatus },
              });
            } catch (e) {
              console.warn('[BulkActionBar] follow-up email failed', id, e);
            }
          }

          toast({ title: 'Updated', description: `Marked as ${q.label} (${allIds.length})` });
          await onDone();
          onClear();
        } catch (e: any) {
          toast({ title: 'Bulk update failed', description: e?.message || 'Could not apply changes', variant: 'destructive' });
        } finally {
          setBusy(null);
          setQueue(null);
        }
      },
    });
  };

  return (
    <>
      {count > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 shadow-sm">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              {count}
            </span>
            selected
          </span>

          <div className="h-4 w-px bg-border mx-1" />

          <AssignMenu
            currentAssigneeId={null}
            onAssign={runAssign}
            trigger={
              <button
                type="button"
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                {busy === 'assign' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Assign…
              </button>
            }
          />

          {QUICK_STAGES.map((q) => {
            const Icon = q.icon;
            const key = `stage-${q.stage}`;
            return (
              <button
                key={q.stage}
                type="button"
                disabled={!!busy}
                onClick={() => startStageChange(q)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs font-medium disabled:opacity-50',
                  q.tone,
                )}
                title="Review email, then apply to all selected"
              >
                {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                {q.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <ClaimStatusEmailPreviewDialog
        pending={pendingChange}
        onClose={() => { setPendingChange(null); setQueue(null); }}
      />
    </>
  );
};
