import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserRoundCog, Check, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLeadReassignRequests, type LeadReassignRequest } from '@/hooks/useLeadReassignRequests';

/**
 * Lead handover requests — manager queue.
 *
 * Agents can ask for a lead to be moved to a colleague, but only a manager
 * approving here actually reassigns it. Declining leaves the lead exactly
 * where it is.
 */
export const ReassignRequestsPanel: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { pending, requests, agentName, isManagement, decide, loading } = useLeadReassignRequests(userRole);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (!isManagement) return null;

  const handle = async (r: LeadReassignRequest, status: 'approved' | 'declined') => {
    setBusy(r.id);
    try {
      await decide(r, status, notes[r.id]);
      toast[status === 'approved' ? 'success' : 'info'](
        status === 'approved' ? `Lead moved to ${agentName(r.requested_to)}` : 'Request declined — lead unchanged',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the decision');
    } finally {
      setBusy(null);
    }
  };

  const decided = requests.filter((r) => r.status !== 'pending').slice(0, 8);

  return (
    <section id="handover-requests" className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 flex items-start gap-2">
        <UserRoundCog className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Lead handover requests</h3>
            {pending.length > 0 && <Badge variant="destructive">{pending.length} waiting</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agents can ask for a lead to be passed to a colleague. Nothing moves until you approve it here.
          </p>
        </div>
      </div>

      <div className="border-t border-border divide-y divide-border">
        {loading && <div className="px-5 py-4 text-sm text-muted-foreground">Loading…</div>}

        {!loading && pending.length === 0 && (
          <div className="px-5 py-4 text-sm text-muted-foreground">No handover requests waiting.</div>
        )}

        {pending.map((r) => (
          <div key={r.id} className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">{r.lead_label || 'Lead'}</span>
              {r.lead_reg && <Badge variant="outline">{r.lead_reg}</Badge>}
              <span className="text-muted-foreground">
                {agentName(r.current_owner_id)} <ArrowRight className="inline h-3.5 w-3.5" /> {agentName(r.requested_to)}
              </span>
              <span className="text-xs text-muted-foreground">
                · asked by {agentName(r.requested_by)} · {new Date(r.created_at).toLocaleString('en-GB')}
              </span>
            </div>
            <p className="text-sm text-foreground/80 italic">“{r.reason}”</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={notes[r.id] || ''}
                onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                placeholder="Note (optional)"
                className="max-w-xs h-9"
              />
              <Button size="sm" onClick={() => handle(r, 'approved')} disabled={busy === r.id} className="gap-1">
                <Check className="h-4 w-4" /> Approve & move
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handle(r, 'declined')}
                disabled={busy === r.id}
                className="gap-1"
              >
                <X className="h-4 w-4" /> Decline
              </Button>
            </div>
          </div>
        ))}
      </div>

      {decided.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-5 py-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Recent decisions</div>
          {decided.map((r) => (
            <div key={r.id} className="text-xs text-muted-foreground">
              {r.lead_label || 'Lead'} {r.lead_reg ? `(${r.lead_reg})` : ''} — {r.status} ·{' '}
              {agentName(r.requested_by)} → {agentName(r.requested_to)} ·{' '}
              {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('en-GB') : ''}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ReassignRequestsPanel;
